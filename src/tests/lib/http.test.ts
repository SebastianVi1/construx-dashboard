import { afterEach, describe, expect, it } from 'bun:test'
import axios, { AxiosError, type AxiosInstance } from 'axios'
import { z } from 'zod'
import { fakeStorage } from '../support/fakeStorage'
import {
  ApiError,
  configureHttp,
  deleteJson,
  downloadPresigned,
  getJson,
  REQUEST_TIMEOUT_MS,
  StorageUploadError,
  uploadPresigned,
  type HttpRequest,
  type HttpResponse,
} from '../../lib/http'

const okSchema = z.object({ ok: z.boolean() })

/** In-memory fetcher: answers each request with `answer` and records it. */
function fakeFetcher(answer: (request: HttpRequest) => HttpResponse) {
  const requests: HttpRequest[] = []
  configureHttp({
    baseUrl: '/api',
    fetcher: async (request) => {
      requests.push(request)
      return answer(request)
    },
  })
  return requests
}

afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

describe('getJson', () => {
  it('GETs the path under the base URL and parses the body', async () => {
    const requests = fakeFetcher(() => ({ status: 200, data: { ok: true } }))

    await expect(getJson('/sites', okSchema)).resolves.toEqual({ ok: true })
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual(['get /api/sites'])
  })

  it('throws ApiError with the status and problem code on a non-2xx answer', async () => {
    fakeFetcher(() => ({ status: 409, data: { code: 'DUPLICATE' } }))

    const error = await getJson('/sites', okSchema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'DUPLICATE' })
  })

  it('keeps the other problem properties readable, such as a rule\'s action and requirement', async () => {
    fakeFetcher(() => ({
      status: 400,
      data: { type: 'about:blank', status: 400, code: 'ROLE_DEPENDENCY_MISSING', action: 'MANAGE_PLAN', requires: 'VIEW_PLAN' },
    }))

    const error = (await getJson('/sites', okSchema).catch((e: unknown) => e)) as ApiError
    expect(error.problem).toMatchObject({ action: 'MANAGE_PLAN', requires: 'VIEW_PLAN' })
    expect(error.problemString('requires')).toBe('VIEW_PLAN')
    expect(error.problemString('status')).toBeUndefined()
  })

  it('reads a numeric problem property, ignoring other types', () => {
    const error = new ApiError(409, undefined, 'ROLE_REPLACEMENT_REQUIRED', { memberCount: 2, formerMemberCount: '1', bad: Number.NaN })

    expect(error.problemNumber('memberCount')).toBe(2)
    expect(error.problemNumber('formerMemberCount')).toBeUndefined()
    expect(error.problemNumber('bad')).toBeUndefined()
    expect(error.problemNumber('missing')).toBeUndefined()
  })

  it('has an empty problem when the body is not an object', async () => {
    fakeFetcher(() => ({ status: 502, data: '<html>Bad gateway</html>' }))

    const error = (await getJson('/sites', okSchema).catch((e: unknown) => e)) as ApiError
    expect(error.problem).toEqual({})
    expect(error.problemString('code')).toBeUndefined()
  })
})

describe('API URL guard', () => {
  it('refuses paths that could leave the API base, before any request is sent', async () => {
    const requests = fakeFetcher(() => ({ status: 200, data: { ok: true } }))

    for (const path of ['//evil.test/x', '/../admin', '/sites/../../x', '/a\\b', '/a\nb', 'https://evil.test/x', 'sites']) {
      const error = await getJson(path, okSchema).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBeUndefined()
    }
    expect(requests).toHaveLength(0)
  })

  it('refuses an unsafe path on an unsafe call before fetching the CSRF proof', async () => {
    const requests = fakeFetcher(() => ({ status: 204, data: undefined }))

    await expect(deleteJson('//evil.test/sites/1')).rejects.toBeInstanceOf(ApiError)
    expect(requests).toHaveLength(0)
  })

  it('resolves dot segments that stay under the base', async () => {
    const requests = fakeFetcher(() => ({ status: 200, data: { ok: true } }))

    await getJson('/sites/./x', okSchema)
    expect(requests.map((r) => r.url)).toEqual(['/api/sites/x'])
  })

  it('accepts a normal path with a query string', async () => {
    const requests = fakeFetcher(() => ({ status: 200, data: { ok: true } }))

    await getJson('/sites?folderId=f-1&fresh=5', okSchema)
    expect(requests.map((r) => r.url)).toEqual(['/api/sites?folderId=f-1&fresh=5'])
  })
})

describe('request timeout', () => {
  it('gives every API request the shared timeout', async () => {
    const configs: unknown[] = []
    configureHttp({
      baseUrl: '/api',
      client: {
        get: async (_url: string, config: unknown) => {
          configs.push(config)
          return { status: 200, data: { ok: true } }
        },
      } as unknown as AxiosInstance,
    })

    await getJson('/sites', okSchema)
    expect(configs[0]).toMatchObject({ withCredentials: true, timeout: REQUEST_TIMEOUT_MS })
  })

  it('turns a timed-out request into a network ApiError without a status', async () => {
    configureHttp({
      baseUrl: '/api',
      client: {
        get: async () => {
          throw Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' })
        },
      } as unknown as AxiosInstance,
    })

    const error = await getJson('/sites', okSchema).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBeUndefined()
  })
})

describe('CSRF retry', () => {
  const csrfAnswer: HttpResponse = { status: 200, data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

  it('retries once after a CSRF_INVALID 403, then gives up', async () => {
    const requests = fakeFetcher((request) =>
      request.method === 'get' ? csrfAnswer : { status: 403, data: { code: 'CSRF_INVALID' } },
    )

    await expect(deleteJson('/sites/1')).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' })
    expect(requests.filter((r) => r.method === 'delete')).toHaveLength(2)
  })

  it('does not retry a permission FORBIDDEN', async () => {
    const requests = fakeFetcher((request) =>
      request.method === 'get' ? csrfAnswer : { status: 403, data: { code: 'FORBIDDEN' } },
    )

    await expect(deleteJson('/sites/1')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(requests.filter((r) => r.method === 'delete')).toHaveLength(1)
  })
})

describe('downloadPresigned', () => {
  it('resolves with the stored file', async () => {
    fakeStorage(200)

    const blob = await downloadPresigned('https://s3.example/doc?sig=1')
    expect(await blob.text()).toBe('file-bytes')
  })

  it('throws ApiError with the storage status instead of returning the error page of an expired link', async () => {
    fakeStorage(403, '<Error>AccessDenied</Error>')

    const error = await downloadPresigned('https://s3.example/doc?sig=1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })
})

describe('presigned URL guard', () => {
  it('refuses unsafe storage URLs before any transfer', async () => {
    const transfers = fakeStorage(200)

    for (const url of ['javascript:alert(1)', 'http://s3.example/doc', 'https://user:pass@s3.example/doc', 'not a url']) {
      expect(await downloadPresigned(url).catch((e: unknown) => e)).toBeInstanceOf(ApiError)
    }
    expect(transfers).toHaveLength(0)
  })

  it('refuses a storage URL on the API origin, so API cookies never reach it', async () => {
    configureHttp({ baseUrl: 'https://api.example' })
    const transfers = fakeStorage(200)

    try {
      expect(await downloadPresigned('https://api.example/x').catch((e: unknown) => e)).toBeInstanceOf(ApiError)
      expect(transfers).toHaveLength(0)
    } finally {
      configureHttp({ baseUrl: '/api' })
    }
  })

  it('allows a local HTTP stand-in for storage', async () => {
    fakeStorage(200)

    await expect(downloadPresigned('http://localhost:9000/doc')).resolves.toBeInstanceOf(Blob)
  })
})

describe('uploadPresigned', () => {
  it('PUTs the file with the signed headers and no credentials', async () => {
    const transfers = fakeStorage(200)
    const file = new Blob(['hello'], { type: 'text/plain' })

    await uploadPresigned('https://s3.example/put?sig=1', file, { 'Content-Type': 'text/plain' })
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      method: 'put',
      url: 'https://s3.example/put?sig=1',
      headers: { 'Content-Type': 'text/plain' },
      withCredentials: false,
      data: file,
    })
  })

  it('throws StorageUploadError with the storage status when storage rejects the upload', async () => {
    fakeStorage(500)

    const error = await uploadPresigned('https://s3.example/put?sig=1', new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUploadError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500 })
  })

  it('refuses an unsafe URL before any request is sent', async () => {
    const transfers = fakeStorage(200)

    const error = await uploadPresigned('http://s3.example/put', new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUploadError)
    expect(error).toMatchObject({ status: 0 })
    expect(transfers).toHaveLength(0)
  })

  it('reports progress from 0 to 1 and 1 once stored', async () => {
    fakeStorage(200)
    const progress: number[] = []

    await uploadPresigned('https://s3.example/put', new Blob(['x']), {}, (fraction) => progress.push(fraction))
    expect(progress).toEqual([0.5, 1])
  })

  it('throws StorageUploadError with no status on a network failure', async () => {
    configureHttp({
      storageClient: axios.create({
        adapter: async (config) => {
          throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
        },
      }),
    })

    const error = await uploadPresigned('https://s3.example/put', new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUploadError)
    expect(error).toMatchObject({ status: 0 })
  })
})

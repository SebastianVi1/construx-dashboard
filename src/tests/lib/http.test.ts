import { afterEach, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  ApiError,
  configureHttp,
  downloadPresigned,
  getJson,
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
})

/** Fake presigned storage: answers every transfer with `status` and records it. */
function fakeStorage(status: number, body = 'file-bytes') {
  const transfers: { url: string; init?: RequestInit }[] = []
  configureHttp({
    storageFetch: async (url, init) => {
      transfers.push({ url, init })
      return new Response(body, { status })
    },
  })
  return transfers
}

describe('downloadPresigned', () => {
  it('resolves with the stored file', async () => {
    fakeStorage(200)

    const blob = await downloadPresigned('https://s3.example/doc?sig=1')
    expect(await blob.text()).toBe('file-bytes')
  })

  it('throws ApiError instead of returning the error page of an expired link', async () => {
    fakeStorage(403, '<Error>AccessDenied</Error>')

    const error = await downloadPresigned('https://s3.example/doc?sig=1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })
})

describe('uploadPresigned', () => {
  it('PUTs the file with the signed headers', async () => {
    const transfers = fakeStorage(200)
    const file = new Blob(['hello'], { type: 'text/plain' })

    await uploadPresigned('https://s3.example/put?sig=1', file, { 'Content-Type': 'text/plain' })
    expect(transfers).toHaveLength(1)
    expect(transfers[0].init).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: file })
  })

  it('throws ApiError when storage rejects the upload', async () => {
    fakeStorage(500)

    const error = await uploadPresigned('https://s3.example/put?sig=1', new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500 })
  })
})

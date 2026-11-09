import { afterEach, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { ApiError, configureHttp, getJson, type HttpRequest, type HttpResponse } from '../../lib/http'

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

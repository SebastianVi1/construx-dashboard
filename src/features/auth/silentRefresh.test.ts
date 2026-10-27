import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { configureAuthApi, deleteJson, getJson, login, onSessionExpired, sendJson } from './authApi'

type Config = { headers?: Record<string, string> }

const okSchema = z.object({ ok: z.boolean() })

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } })

/**
 * Fake backend: `/auth/csrf` hands out numbered proofs, `/auth/refresh` is
 * answered by `refreshImpl`, every other request by `businessImpl`. Records
 * the order of calls so tests can assert refresh/retry sequences.
 */
function fakeBackend(options: {
  business: (call: number, config: Config | undefined) => unknown
  refresh?: () => unknown
}) {
  const calls: string[] = []
  let proofs = 0
  let businessCalls = 0
  const handle = async (method: string, url: string, config: Config | undefined) => {
    const path = url.replace('/api', '')
    calls.push(`${method} ${path}`)
    if (path === '/auth/csrf') return { data: { headerName: 'X-XSRF-TOKEN', token: `proof-${++proofs}` } }
    if (path === '/auth/refresh') {
      // Let concurrent callers pile up while the refresh is in flight.
      await new Promise((resolve) => setTimeout(resolve, 5))
      return options.refresh ? options.refresh() : { status: 204 }
    }
    return options.business(++businessCalls, config)
  }
  const client = {
    get: mock((url: string, config?: Config) => handle('GET', url, config)),
    post: mock((url: string, _body: unknown, config?: Config) => handle('POST', url, config)),
    put: mock((url: string, _body: unknown, config?: Config) => handle('PUT', url, config)),
    patch: mock((url: string, _body: unknown, config?: Config) => handle('PATCH', url, config)),
    delete: mock((url: string, config?: Config) => handle('DELETE', url, config)),
  }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { calls, count: (entry: string) => calls.filter((call) => call === entry).length }
}

describe('silent refresh on 401', () => {
  let expired: ReturnType<typeof mock>
  let unsubscribe: () => void

  beforeEach(() => {
    expired = mock(() => {})
    unsubscribe = onSessionExpired(expired)
  })

  afterEach(() => {
    unsubscribe()
    mock.restore()
  })

  it('getJson: refreshes once after a 401 and retries the request once', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(401)
        return { status: 200, data: { ok: true } }
      },
    })

    await expect(getJson('/sites', okSchema)).resolves.toEqual({ ok: true })
    expect(backend.calls).toEqual(['GET /sites', 'GET /auth/csrf', 'POST /auth/refresh', 'GET /sites'])
    expect(expired).toHaveBeenCalledTimes(0)
  })

  it('sendJson: refreshes after a 401 and retries with a fresh CSRF proof', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(401)
        return { status: 201, data: { ok: true } }
      },
    })

    await expect(sendJson('post', '/sites', { name: 'A' }, 201, okSchema)).resolves.toEqual({ ok: true })
    expect(backend.calls).toEqual([
      'GET /auth/csrf',
      'POST /sites',
      'GET /auth/csrf',
      'POST /auth/refresh',
      'GET /auth/csrf',
      'POST /sites',
    ])
  })

  it('deleteJson: refreshes after a 401 and retries the delete', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(401)
        return { status: 204 }
      },
    })

    await deleteJson('/sites/1')
    expect(backend.count('DELETE /sites/1')).toBe(2)
    expect(backend.count('POST /auth/refresh')).toBe(1)
  })

  it('shares one refresh between concurrent 401s', async () => {
    const backend = fakeBackend({
      // Before the refresh every request fails with 401; their retries succeed.
      business: () =>
        backend.count('POST /auth/refresh') === 0
          ? Promise.reject(httpError(401))
          : { status: 200, data: { ok: true } },
    })

    const results = await Promise.all([getJson('/sites', okSchema), getJson('/members', okSchema)])
    expect(results).toEqual([{ ok: true }, { ok: true }])
    expect(backend.count('POST /auth/refresh')).toBe(1)
    expect(backend.count('GET /sites')).toBe(2)
    expect(backend.count('GET /members')).toBe(2)
  })

  it('signs out once the refresh fails and does not loop', async () => {
    const backend = fakeBackend({
      business: () => {
        throw httpError(401)
      },
      refresh: () => {
        throw httpError(401)
      },
    })

    await expect(getJson('/sites', okSchema)).rejects.toMatchObject({ status: 401 })
    expect(backend.count('GET /sites')).toBe(1)
    expect(backend.count('POST /auth/refresh')).toBe(1)
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('does not refresh again when the retry after a refresh still 401s', async () => {
    const backend = fakeBackend({
      business: () => {
        throw httpError(401)
      },
    })

    await expect(getJson('/sites', okSchema)).rejects.toMatchObject({ status: 401 })
    expect(backend.count('GET /sites')).toBe(2)
    expect(backend.count('POST /auth/refresh')).toBe(1)
  })

  it('never refreshes for an auth endpoint', async () => {
    const backend = fakeBackend({
      business: () => {
        throw httpError(401)
      },
    })

    await expect(login({ email: 'person@example.com', password: 'wrong' })).rejects.toMatchObject({ status: 401 })
    await expect(getJson('/auth/me', okSchema)).rejects.toMatchObject({ status: 401 })
    expect(backend.count('POST /auth/refresh')).toBe(0)
    expect(expired).toHaveBeenCalledTimes(0)
  })

  it('still retries once with a new CSRF proof after a 403, without refreshing', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(403)
        return { status: 201, data: { ok: true } }
      },
    })

    await expect(sendJson('post', '/sites', {}, 201, okSchema)).resolves.toEqual({ ok: true })
    expect(backend.calls).toEqual(['GET /auth/csrf', 'POST /sites', 'GET /auth/csrf', 'POST /sites'])
  })

  it('composes refresh and CSRF retry, each at most once', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(401)
        if (call === 2) throw httpError(403)
        if (call === 3) return { status: 201, data: { ok: true } }
        throw new Error('unexpected extra request')
      },
    })

    await expect(sendJson('post', '/sites', {}, 201, okSchema)).resolves.toEqual({ ok: true })
    expect(backend.count('POST /sites')).toBe(3)
    expect(backend.count('POST /auth/refresh')).toBe(1)
  })

  it('does not retry a second 403 after a refresh', async () => {
    const backend = fakeBackend({
      business: (call) => {
        if (call === 1) throw httpError(403)
        if (call === 2) throw httpError(401)
        throw httpError(403)
      },
    })

    await expect(sendJson('post', '/sites', {}, 201, okSchema)).rejects.toMatchObject({ status: 403 })
    expect(backend.count('POST /sites')).toBe(3)
    expect(backend.count('POST /auth/refresh')).toBe(1)
  })
})

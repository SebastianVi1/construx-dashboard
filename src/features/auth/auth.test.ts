import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createAuthApi } from './authApi'
import { loginSchema, registrationSchema } from './schemas'

describe('auth input validation', () => {
  it('trims a valid email and requires a login password', () => {
    expect(loginSchema.parse({ email: ' person@example.com ', password: 'secret' })).toEqual({
      email: 'person@example.com',
      password: 'secret',
    })
    expect(loginSchema.safeParse({ email: 'bad', password: '' }).success).toBe(false)
  })

  it('requires a registration password of at least 12 characters', () => {
    expect(registrationSchema.safeParse({ email: 'person@example.com', password: '12345678901' }).success).toBe(false)
    expect(registrationSchema.safeParse({ email: 'person@example.com', password: '123456789012' }).success).toBe(true)
  })
})

describe('auth API', () => {
  afterEach(() => mock.restore())

  it('obtains CSRF proof and sends credentials with cookies for login', async () => {
    const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/csrf')) {
        return new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'proof' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      expect(init?.credentials).toBe('include')
      expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('proof')
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.com', password: 'secret' })
      return new Response(null, { status: 204 })
    })

    await createAuthApi('/api', fetcher).login({ email: 'person@example.com', password: 'secret' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('accepts bodyless registration and rejects malformed CSRF proof before POST', async () => {
    const accepted = mock(async (input: RequestInfo | URL) =>
      String(input).endsWith('/csrf')
        ? new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'proof' }), { status: 200 })
        : new Response(null, { status: 202 }),
    )
    await createAuthApi('/api', accepted).register({ email: 'person@example.com', password: '123456789012' })
    expect(accepted).toHaveBeenCalledTimes(2)

    const malformed = mock(async () => new Response(JSON.stringify({ headerName: 'Bad Header', token: 'proof' })))
    await expect(createAuthApi('/api', malformed).login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow()
    expect(malformed).toHaveBeenCalledTimes(1)
  })

  it('does not treat an unexpected success status as authenticated', async () => {
    const fetcher = mock(async (input: RequestInfo | URL) =>
      String(input).endsWith('/csrf')
        ? new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'proof' }))
        : new Response('{}', { status: 200 }),
    )
    await expect(createAuthApi('/api', fetcher).login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow()
  })
})

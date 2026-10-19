import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, createAuthApi } from './authApi'
import { loginSchema, registrationSchema } from './schemas'

type PostCall = [
  url: string,
  data: unknown,
  config?: { withCredentials?: boolean; headers?: Record<string, string> },
]

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
    const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
    const post = mock(async () => ({ status: 204 }))
    const client = { get, post } as unknown as AxiosInstance

    await createAuthApi('/api', client).login({ email: 'person@example.com', password: 'secret' })

    expect(get).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)

    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/login')
    expect(data).toEqual({ email: 'person@example.com', password: 'secret' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('accepts a successful registration and rejects malformed CSRF proof before POST', async () => {
    const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
    const post = mock(async () => ({ status: 202 }))
    const client = { get, post } as unknown as AxiosInstance

    await createAuthApi('/api', client).register({ email: 'person@example.com', password: '123456789012' })
    expect(get).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)

    const badGet = mock(async () => ({ data: { headerName: 'Bad Header', token: 'proof' } }))
    const badPost = mock(async () => ({ status: 204 }))
    const badClient = { get: badGet, post: badPost } as unknown as AxiosInstance

    await expect(createAuthApi('/api', badClient).login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
    expect(badGet).toHaveBeenCalledTimes(1)
    expect(badPost).toHaveBeenCalledTimes(0)
  })

  it('does not treat an unexpected success status as authenticated', async () => {
    const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
    const post = mock(async () => ({ status: 200 }))
    const client = { get, post } as unknown as AxiosInstance

    await expect(createAuthApi('/api', client).login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
  })

  it('maps request failures to AuthApiError', async () => {
    const get = mock(async () => {
      throw new Error('network down')
    })
    const client = { get, post: mock(async () => ({ status: 204 })) } as unknown as AxiosInstance

    await expect(createAuthApi('/api', client).login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
    expect(get).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi, login, logout, register } from './authApi'
import { loginSchema, registrationSchema } from './schemas'

type PostCall = [
  url: string,
  data?: unknown,
  config?: { withCredentials?: boolean; headers?: Record<string, string> },
]

function stubApi(getImpl: () => unknown, postImpl: () => unknown) {
  const get = mock(async () => getImpl())
  const post = mock(async () => postImpl())
  configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, post }
}

const csrfOk = () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } })

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

  it('login: obtains CSRF proof and posts credentials with cookies', async () => {
    const { get, post } = stubApi(csrfOk, () => ({ status: 204 }))
    await login({ email: 'person@example.com', password: 'secret' })

    expect(get).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)

    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/login')
    expect(data).toEqual({ email: 'person@example.com', password: 'secret' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('register: posts registration to the register endpoint', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 202 }))
    await register({ email: 'person@example.com', password: '123456789012' })

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/register')
    expect(data).toEqual({ email: 'person@example.com', password: '123456789012' })
  })

  it('logout: posts an empty body to the logout endpoint', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 204 }))
    await logout()

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/logout')
    expect(data).toBeUndefined()
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('rejects malformed CSRF proof before POST', async () => {
    const { get, post } = stubApi(() => ({ data: { headerName: 'Bad Header', token: 'proof' } }), () => ({ status: 204 }))
    await expect(login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
    expect(get).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(0)
  })

  it('does not treat an unexpected success status as authenticated', async () => {
    stubApi(csrfOk, () => ({ status: 200 }))
    await expect(login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
  })

  it('maps request failures to AuthApiError', async () => {
    const { get } = stubApi(() => {
      throw new Error('network down')
    }, () => ({ status: 204 }))

    await expect(login({ email: 'person@example.com', password: 'secret' })).rejects.toThrow(AuthApiError)
    expect(get).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import {
  AuthApiError,
  configureAuthApi,
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  refresh,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../../../features/auth/authApi'
import {
  makeForgotPasswordSchema,
  makeLoginSchema,
  makeRegistrationSchema,
  makeResetPasswordSchema,
} from '../../../features/auth/schemas'
import { messages } from '../../../i18n/messages'

type PostCall = [
  url: string,
  data?: unknown,
  config?: { withCredentials?: boolean; headers?: Record<string, string> },
]

type GetCall = [url: string, config?: { withCredentials?: boolean; headers?: Record<string, string> }]

function stubApi(getImpl: () => unknown, postImpl: () => unknown) {
  const get = mock(async () => getImpl())
  const post = mock(async () => postImpl())
  configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, post }
}

const csrfOk = () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } })

describe('auth input validation', () => {
  const loginSchema = makeLoginSchema(messages.en.validation)
  const registrationSchema = makeRegistrationSchema(messages.en.validation)

  it('trims a valid email and requires a login password', () => {
    expect(loginSchema.parse({ email: ' person@example.com ', password: 'secret' })).toEqual({
      email: 'person@example.com',
      password: 'secret',
    })
    expect(loginSchema.safeParse({ email: 'bad', password: '' }).success).toBe(false)
  })

  const registration = (password: string, extra: Record<string, string> = {}) => ({
    name: 'Person',
    email: 'person@example.com',
    password,
    confirmPassword: password,
    ...extra,
  })

  it('requires a registration password of at least 12 characters', () => {
    expect(registrationSchema.safeParse(registration('12345678901')).success).toBe(false)
    expect(registrationSchema.safeParse(registration('123456789012')).success).toBe(true)
  })

  it('rejects a registration password longer than 72 characters', () => {
    expect(registrationSchema.safeParse(registration('a'.repeat(72))).success).toBe(true)
    expect(registrationSchema.safeParse(registration('a'.repeat(73))).success).toBe(false)
  })

  it('requires a registration name and trims it', () => {
    expect(registrationSchema.safeParse(registration('123456789012', { name: '  ' })).success).toBe(false)
    expect(registrationSchema.parse(registration('123456789012', { name: ' Person ' })).name).toBe('Person')
  })

  it('requires the registration confirmation to match the password', () => {
    const result = registrationSchema.safeParse(registration('123456789012', { confirmPassword: 'different-pass' }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(messages.en.validation.passwordMismatch)
  })
})

describe('password recovery validation', () => {
  const forgotSchema = makeForgotPasswordSchema(messages.en.validation)
  const resetSchema = makeResetPasswordSchema(messages.en.validation)
  const reset = (newPassword: string, confirmPassword = newPassword) =>
    resetSchema.safeParse({ newPassword, confirmPassword })

  it('trims a valid email and rejects a bad one', () => {
    expect(forgotSchema.parse({ email: ' person@example.com ' })).toEqual({ email: 'person@example.com' })
    expect(forgotSchema.safeParse({ email: 'bad' }).success).toBe(false)
    expect(forgotSchema.safeParse({ email: '' }).success).toBe(false)
  })

  it('accepts a new password of 12 to 72 characters', () => {
    expect(reset('a'.repeat(11)).success).toBe(false)
    expect(reset('a'.repeat(12)).success).toBe(true)
    expect(reset('a'.repeat(72)).success).toBe(true)
    expect(reset('a'.repeat(73)).success).toBe(false)
  })

  it('rejects a confirmation that does not match, on the confirm field', () => {
    const result = reset('a'.repeat(12), 'b'.repeat(12))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
    expect(result.error?.issues[0]?.message).toBe(messages.en.validation.passwordMismatch)
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
    await register({ name: 'Person', email: 'person@example.com', password: '123456789012' })

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/register')
    expect(data).toEqual({ name: 'Person', email: 'person@example.com', password: '123456789012' })
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

  it('getCurrentUser: fetches /me with credentials and parses the user', async () => {
    const { get } = stubApi(
      () => ({ data: { id: 1, email: 'person@example.com' }, status: 200 }),
      () => ({ status: 204 }),
    )
    const user = await getCurrentUser()

    expect(user).toEqual({ id: 1, email: 'person@example.com' })
    expect(get).toHaveBeenCalledTimes(1)
    const [url, config] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/auth/me')
    expect(config?.withCredentials).toBe(true)
  })

  it('getCurrentUser: exposes the HTTP status on failure', async () => {
    const error = Object.assign(new Error('Unauthorized'), { isAxiosError: true, response: { status: 401 } })
    stubApi(() => {
      throw error
    }, () => ({ status: 204 }))

    await expect(getCurrentUser()).rejects.toMatchObject({ status: 401 })
  })

  it('refresh: posts an empty body to the refresh endpoint', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 204 }))
    await refresh()

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/refresh')
    expect(data).toBeUndefined()
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('verifyEmail: posts the one-time token', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 204 }))
    await verifyEmail('abc123')

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/verify')
    expect(data).toEqual({ token: 'abc123' })
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('resendVerification: posts the email', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 202 }))
    await resendVerification('person@example.com')

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/resend')
    expect(data).toEqual({ email: 'person@example.com' })
  })

  it('forgotPassword: posts the email with cookies and CSRF and expects 202', async () => {
    const { get, post } = stubApi(csrfOk, () => ({ status: 202 }))
    await forgotPassword('person@example.com')

    expect(get).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/password/forgot')
    expect(data).toEqual({ email: 'person@example.com' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('forgotPassword: exposes Retry-After seconds on a 429', async () => {
    stubApi(csrfOk, () => {
      throw Object.assign(new Error('Too many'), {
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': '30' } },
      })
    })

    await expect(forgotPassword('person@example.com')).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 })
  })

  it('resetPassword: posts the token and new password with CSRF and expects 204', async () => {
    const { post } = stubApi(csrfOk, () => ({ status: 204 }))
    await resetPassword('reset-token', 'new-password-123')

    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as PostCall
    expect(url).toBe('/api/auth/password/reset')
    expect(data).toEqual({ token: 'reset-token', newPassword: 'new-password-123' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('resetPassword: rejects a 200 instead of 204', async () => {
    stubApi(csrfOk, () => ({ status: 200 }))
    await expect(resetPassword('reset-token', 'new-password-123')).rejects.toMatchObject({ status: 200 })
  })

  it('resetPassword: exposes status 401 for an unusable link', async () => {
    stubApi(csrfOk, () => {
      throw Object.assign(new Error('Unauthorized'), { isAxiosError: true, response: { status: 401 } })
    })
    const result = resetPassword('reset-token', 'new-password-123')
    await expect(result).rejects.toThrow(AuthApiError)
    await expect(result).rejects.toMatchObject({ status: 401 })
  })

  it('resetPassword: exposes Retry-After seconds on a 429', async () => {
    stubApi(csrfOk, () => {
      throw Object.assign(new Error('Too many'), {
        isAxiosError: true,
        response: { status: 429, headers: { 'retry-after': '15' } },
      })
    })
    await expect(resetPassword('reset-token', 'new-password-123')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 15,
    })
  })

  it('exposes Retry-After seconds on a 429 response', async () => {
    const error = Object.assign(new Error('Too many'), {
      isAxiosError: true,
      response: { status: 429, headers: { 'retry-after': '42' } },
    })
    const get = mock(async () => csrfOk())
    const post = mock(async () => {
      throw error
    })
    configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })

    await expect(login({ email: 'person@example.com', password: 'secret' })).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 42,
    })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('refetches the CSRF token and retries once after a 403', async () => {
    let tokens = 0
    const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: `proof-${++tokens}` } }))
    let attempts = 0
    const post = mock(async () => {
      if (++attempts === 1) {
        throw Object.assign(new Error('Forbidden'), { isAxiosError: true, response: { status: 403 } })
      }
      return { status: 204 }
    })
    configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })

    await login({ email: 'person@example.com', password: 'secret' })

    expect(get).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenCalledTimes(2)
    const [, , config] = post.mock.calls[1] as unknown as PostCall
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof-2')
  })

  it('does not retry a second 403', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { isAxiosError: true, response: { status: 403 } })
    const post = mock(async () => {
      throw forbidden
    })
    configureAuthApi({
      client: { get: mock(async () => csrfOk()), post } as unknown as AxiosInstance,
      baseUrl: '/api',
    })

    await expect(logout()).rejects.toMatchObject({ status: 403 })
    expect(post).toHaveBeenCalledTimes(2)
  })
})

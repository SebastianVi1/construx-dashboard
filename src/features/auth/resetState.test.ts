import { describe, expect, it } from 'bun:test'
import { AuthApiError } from './authApi'
import { readResetToken, resetFailure } from './resetState'

describe('readResetToken', () => {
  it('reads and trims the token from the query string', () => {
    expect(readResetToken(new URLSearchParams('token=%20abc123%20'))).toBe('abc123')
  })

  it('returns an empty string for a missing or blank token', () => {
    expect(readResetToken(new URLSearchParams(''))).toBe('')
    expect(readResetToken(new URLSearchParams('token=%20%20'))).toBe('')
  })
})

describe('resetFailure', () => {
  it('maps a 401 to the invalid link state', () => {
    expect(resetFailure(new AuthApiError(401))).toEqual({ kind: 'invalidLink' })
  })

  it('maps a 400 to the password error', () => {
    expect(resetFailure(new AuthApiError(400))).toEqual({ kind: 'password' })
  })

  it('maps a 429 to the rate limit and keeps Retry-After', () => {
    expect(resetFailure(new AuthApiError(429, 20))).toEqual({ kind: 'rateLimited', retryAfterSeconds: 20 })
    expect(resetFailure(new AuthApiError(429))).toEqual({ kind: 'rateLimited', retryAfterSeconds: undefined })
  })

  it('maps anything else to the generic error', () => {
    expect(resetFailure(new AuthApiError(500))).toEqual({ kind: 'generic' })
    expect(resetFailure(new AuthApiError())).toEqual({ kind: 'generic' })
    expect(resetFailure(new Error('boom'))).toEqual({ kind: 'generic' })
  })
})

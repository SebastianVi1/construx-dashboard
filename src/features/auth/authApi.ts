import axios, { type AxiosInstance } from 'axios'
import { getApiBaseUrl } from '../../config/env'
import {
  csrfSchema,
  userSchema,
  type CurrentUser,
  type LoginInput,
  type RegistrationInput,
} from './schemas'

export class AuthApiError extends Error {
  readonly status: number | undefined
  /** Seconds to wait before retrying, from the `Retry-After` header of a 429. */
  readonly retryAfterSeconds: number | undefined

  constructor(status?: number, retryAfterSeconds?: number) {
    super('Authentication request failed')
    this.name = 'AuthApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

let client: AxiosInstance = axios.create()
let baseUrl = getApiBaseUrl()

/** Override the HTTP client and base URL — used by tests. */
export function configureAuthApi(options: { client?: AxiosInstance; baseUrl?: string }): void {
  if (options.client) client = options.client
  if (options.baseUrl) baseUrl = options.baseUrl
}

/** Map an unknown thrown value to an AuthApiError, preserving the HTTP status. */
function toAuthApiError(error: unknown): AuthApiError {
  if (error instanceof AuthApiError) return error
  if (axios.isAxiosError(error)) {
    return new AuthApiError(error.response?.status, parseRetryAfter(error.response?.headers?.['retry-after']))
  }
  return new AuthApiError()
}

function parseRetryAfter(value: unknown): number | undefined {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

type CsrfProof = { headerName: string; token: string }

async function getCsrfProof(): Promise<CsrfProof> {
  try {
    const response = await client.get(`${baseUrl}/auth/csrf`, {
      withCredentials: true,
      headers: { Accept: 'application/json' },
    })
    return csrfSchema.parse(response.data)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

function csrfConfig(proof: CsrfProof) {
  return {
    withCredentials: true,
    headers: {
      Accept: 'application/problem+json, application/json',
      [proof.headerName]: proof.token,
    },
  }
}

/**
 * POST with a fresh CSRF proof. A 403 may mean the proof was missing or
 * rejected, so refetch it and retry exactly once.
 */
async function postWithCsrf(path: string, body: unknown, expectedStatus: number): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const proof = await getCsrfProof()
    try {
      const response = await client.post(`${baseUrl}${path}`, body, csrfConfig(proof))
      if (response.status !== expectedStatus) throw new AuthApiError(response.status)
      return
    } catch (error) {
      const apiError = toAuthApiError(error)
      if (attempt === 0 && apiError.status === 403) continue
      throw apiError
    }
  }
}

/** Sign in with email and password. Resolves after the session cookie is set. */
export async function login(input: LoginInput): Promise<void> {
  await postWithCsrf('/auth/login', input, 204)
}

/** Request account registration. A duplicate address receives the same accepted status. */
export async function register(input: RegistrationInput): Promise<void> {
  await postWithCsrf('/auth/register', input, 202)
}

/** End the current session. */
export async function logout(): Promise<void> {
  await postWithCsrf('/auth/logout', undefined, 204)
}

/** Fetch the authenticated user. Throws AuthApiError with `status` 401 when unauthenticated. */
export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await client.get(`${baseUrl}/auth/me`, {
      withCredentials: true,
      headers: { Accept: 'application/json' },
    })
    if (response.status !== 200) throw new AuthApiError(response.status)
    return userSchema.parse(response.data)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** Rotate the session and receive replacement auth cookies. */
export async function refresh(): Promise<void> {
  await postWithCsrf('/auth/refresh', undefined, 204)
}

/** Submit a one-time email verification token. */
export async function verifyEmail(token: string): Promise<void> {
  await postWithCsrf('/auth/verify', { token }, 204)
}

/** Request a fresh verification email. */
export async function resendVerification(email: string): Promise<void> {
  await postWithCsrf('/auth/resend', { email }, 202)
}

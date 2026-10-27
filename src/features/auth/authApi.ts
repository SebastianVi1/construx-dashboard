import axios, { type AxiosInstance } from 'axios'
import type { ZodType } from 'zod'
import { getApiBaseUrl } from '../../config/env'
import {
  csrfSchema,
  userSchema,
  type CurrentUser,
  type LoginInput,
  type RegistrationInput,
} from './schemas'

/**
 * Failure of any backend request made through this client (auth and business
 * endpoints alike). `code` is the `ProblemDetail` code, e.g. `VALIDATION_FAILED`.
 */
export class AuthApiError extends Error {
  readonly status: number | undefined
  /** Seconds to wait before retrying, from the `Retry-After` header of a 429. */
  readonly retryAfterSeconds: number | undefined
  /** `code` property of the RFC 7807 problem body, when present. */
  readonly code: string | undefined

  constructor(status?: number, retryAfterSeconds?: number, code?: string) {
    super('Authentication request failed')
    this.name = 'AuthApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.code = code
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
    return new AuthApiError(
      error.response?.status,
      parseRetryAfter(error.response?.headers?.['retry-after']),
      parseProblemCode(error.response?.data),
    )
  }
  return new AuthApiError()
}

function parseProblemCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

/** Parse a response body, turning a shape mismatch into an AuthApiError. */
function parseBody<T>(schema: ZodType<T>, data: unknown, status: number): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new AuthApiError(status)
  return result.data
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

type UnsafeMethod = 'post' | 'put' | 'patch'

/**
 * Send an unsafe request with a fresh CSRF proof. A 403 may mean the proof was
 * missing or rejected, so refetch it and retry exactly once. Resolves with the
 * response body.
 */
async function sendWithCsrf(
  method: UnsafeMethod,
  path: string,
  body: unknown,
  expectedStatus: number,
): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    const proof = await getCsrfProof()
    try {
      const response = await client[method](`${baseUrl}${path}`, body, csrfConfig(proof))
      if (response.status !== expectedStatus) throw new AuthApiError(response.status)
      return response.data
    } catch (error) {
      const apiError = toAuthApiError(error)
      if (attempt === 0 && apiError.status === 403) continue
      throw apiError
    }
  }
}

async function postWithCsrf(path: string, body: unknown, expectedStatus: number): Promise<void> {
  await sendWithCsrf('post', path, body, expectedStatus)
}

/**
 * GET a JSON resource under the API base URL with the session cookies and
 * parse it. Shared by every feature so they all use this one HTTP client.
 */
export async function getJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  try {
    const response = await client.get(`${baseUrl}${path}`, {
      withCredentials: true,
      headers: { Accept: 'application/json' },
    })
    if (response.status !== 200) throw new AuthApiError(response.status)
    return parseBody(schema, response.data, response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** POST/PUT/PATCH JSON with CSRF proof, expect `expectedStatus` and parse the body. */
export async function sendJson<T>(
  method: UnsafeMethod,
  path: string,
  body: unknown,
  expectedStatus: number,
  schema: ZodType<T>,
): Promise<T> {
  const data = await sendWithCsrf(method, path, body, expectedStatus)
  return parseBody(schema, data, expectedStatus)
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

/** Request a password reset link. Every address receives the same accepted status. */
export async function forgotPassword(email: string): Promise<void> {
  await postWithCsrf('/auth/password/forgot', { email }, 202)
}

/**
 * Choose a new password with a one-time reset token. Does not sign in: the
 * backend revokes every session, so the user signs in with the new password.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await postWithCsrf('/auth/password/reset', { token, newPassword }, 204)
}

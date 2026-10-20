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

  constructor(status?: number) {
    super('Authentication request failed')
    this.name = 'AuthApiError'
    this.status = status
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
  if (axios.isAxiosError(error)) return new AuthApiError(error.response?.status)
  return new AuthApiError()
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

/** Sign in with email and password. Resolves after the session cookie is set. */
export async function login(input: LoginInput): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/login`, input, csrfConfig(proof))
    if (response.status !== 204) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** Request account registration. A duplicate address receives the same accepted status. */
export async function register(input: RegistrationInput): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/register`, input, csrfConfig(proof))
    if (response.status !== 202) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** End the current session. */
export async function logout(): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/logout`, undefined, csrfConfig(proof))
    if (response.status !== 204) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
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
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/refresh`, undefined, csrfConfig(proof))
    if (response.status !== 204) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** Submit a one-time email verification token. */
export async function verifyEmail(token: string): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/verify`, { token }, csrfConfig(proof))
    if (response.status !== 204) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

/** Request a fresh verification email. */
export async function resendVerification(email: string): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/resend`, { email }, csrfConfig(proof))
    if (response.status !== 202) throw new AuthApiError(response.status)
  } catch (error) {
    throw toAuthApiError(error)
  }
}

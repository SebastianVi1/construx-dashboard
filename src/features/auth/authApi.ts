import axios, { type AxiosInstance } from 'axios'
import { getApiBaseUrl } from '../../config/env'
import { csrfSchema, type LoginInput, type RegistrationInput } from './schemas'

export class AuthApiError extends Error {
  constructor() {
    super('Authentication request failed')
    this.name = 'AuthApiError'
  }
}

let client: AxiosInstance = axios.create()
let baseUrl = getApiBaseUrl()

/** Override the HTTP client and base URL — used by tests. */
export function configureAuthApi(options: { client?: AxiosInstance; baseUrl?: string }): void {
  if (options.client) client = options.client
  if (options.baseUrl) baseUrl = options.baseUrl
}

type CsrfProof = { headerName: string; token: string }

async function getCsrfProof(): Promise<CsrfProof> {
  try {
    const response = await client.get(`${baseUrl}/auth/csrf`, {
      withCredentials: true,
      headers: { Accept: 'application/json' },
    })
    return csrfSchema.parse(response.data)
  } catch {
    throw new AuthApiError()
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
    if (response.status !== 204) throw new AuthApiError()
  } catch {
    throw new AuthApiError()
  }
}

/** Request account registration. A duplicate address receives the same accepted status. */
export async function register(input: RegistrationInput): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/register`, input, csrfConfig(proof))
    if (response.status !== 202) throw new AuthApiError()
  } catch {
    throw new AuthApiError()
  }
}

/** End the current session. */
export async function logout(): Promise<void> {
  const proof = await getCsrfProof()
  try {
    const response = await client.post(`${baseUrl}/auth/logout`, undefined, csrfConfig(proof))
    if (response.status !== 204) throw new AuthApiError()
  } catch {
    throw new AuthApiError()
  }
}

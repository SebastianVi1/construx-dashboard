import { getApiBaseUrl } from '../../config/env'
import { csrfSchema, problemSchema, type LoginInput, type RegistrationInput } from './schemas'

export class AuthApiError extends Error {
  constructor() {
    super('Authentication request failed')
    this.name = 'AuthApiError'
  }
}

async function inspectError(response: Response) {
  if (response.headers.get('content-type')?.includes('json')) {
    try {
      problemSchema.safeParse(await response.json())
    } catch {
      // Malformed backend data never becomes user-facing copy.
    }
  }
  throw new AuthApiError()
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function createAuthApi(baseUrl = getApiBaseUrl(), fetcher: Fetcher = fetch) {
  async function csrfProof() {
    let response: Response
    try {
      response = await fetcher(`${baseUrl}/auth/csrf`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
    } catch {
      throw new AuthApiError()
    }
    if (!response.ok) await inspectError(response)

    try {
      return csrfSchema.parse(await response.json())
    } catch {
      throw new AuthApiError()
    }
  }

  async function submit(path: '/auth/login' | '/auth/register', input: LoginInput | RegistrationInput, successStatus: number) {
    const proof = await csrfProof()
    let response: Response
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/problem+json, application/json',
          'Content-Type': 'application/json',
          [proof.headerName]: proof.token,
        },
        body: JSON.stringify(input),
      })
    } catch {
      throw new AuthApiError()
    }
    if (response.status !== successStatus) await inspectError(response)
  }

  return {
    login: (input: LoginInput) => submit('/auth/login', input, 204),
    register: (input: RegistrationInput) => submit('/auth/register', input, 202),
  }
}

export const authApi = createAuthApi()

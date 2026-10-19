import axios, { type AxiosInstance } from 'axios'
import { getApiBaseUrl } from '../../config/env'
import { csrfSchema, type LoginInput, type RegistrationInput } from './schemas'

export class AuthApiError extends Error {
  constructor() {
    super('Authentication request failed')
    this.name = 'AuthApiError'
  }
}

export function createAuthApi(baseUrl = getApiBaseUrl(), client: AxiosInstance = axios.create()) {
  async function csrfProof() {
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

  async function submit(path: '/auth/login' | '/auth/register', input: LoginInput | RegistrationInput, successStatus: number) {
    const proof = await csrfProof()
    let status: number
    try {
      status = (
        await client.post(`${baseUrl}${path}`, input, {
          withCredentials: true,
          headers: {
            Accept: 'application/problem+json, application/json',
            [proof.headerName]: proof.token,
          },
        })
      ).status
    } catch {
      throw new AuthApiError()
    }
    if (status !== successStatus) throw new AuthApiError()
  }

  return {
    login: (input: LoginInput) => submit('/auth/login', input, 204),
    register: (input: RegistrationInput) => submit('/auth/register', input, 202),
  }
}

export const authApi = createAuthApi()

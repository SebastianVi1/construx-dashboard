import axios, { type AxiosInstance } from 'axios'
import { z, type ZodType } from 'zod'
import { getApiBaseUrl } from '../config/env'

/**
 * The dashboard's one HTTP client for the backend API: JSON transport, CSRF
 * proof (with one retry after a 403), session refresh after a 401 (with one
 * retry), and `ApiError` for every failure. Also the presigned storage
 * transfers (S3 GET/PUT), which skip cookies and CSRF.
 */

/**
 * Failure of any backend request (auth and business endpoints alike), or of a
 * presigned storage transfer. `code` is the `ProblemDetail` code, e.g.
 * `VALIDATION_FAILED`. `status` is undefined for network failures.
 */
export class ApiError extends Error {
  readonly status: number | undefined
  /** Seconds to wait before retrying, from the `Retry-After` header of a 429. */
  readonly retryAfterSeconds: number | undefined
  /** `code` property of the RFC 7807 problem body, when present. */
  readonly code: string | undefined

  constructor(status?: number, retryAfterSeconds?: number, code?: string) {
    super('API request failed')
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.code = code
  }
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export type HttpRequest = {
  method: HttpMethod
  /** Absolute URL: base URL + path. */
  url: string
  body?: unknown
  headers: Record<string, string>
}

export type HttpResponse = {
  status: number
  data: unknown
  headers?: Record<string, unknown>
}

/**
 * Sends one request with the session cookies. Resolves with the response for
 * every HTTP status (including 4xx/5xx); rejects only when no response
 * arrived (network failure).
 */
export type HttpFetcher = (request: HttpRequest) => Promise<HttpResponse>

/** The real fetcher: an axios instance with `withCredentials`. */
export function axiosFetcher(client: AxiosInstance): HttpFetcher {
  return async ({ method, url, body, headers }) => {
    const config = { withCredentials: true, headers }
    try {
      const response =
        method === 'get' || method === 'delete'
          ? await client[method](url, config)
          : await client[method](url, body, config)
      return { status: response.status, data: response.data, headers: response.headers }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, data, headers } = error.response
        return { status, data, headers }
      }
      throw error
    }
  }
}

/** Plain `fetch` used for presigned storage URLs (no cookies, no CSRF). */
export type StorageFetch = (url: string, init?: RequestInit) => Promise<Response>

let fetcher: HttpFetcher = axiosFetcher(axios.create())
let storageFetch: StorageFetch = (url, init) => fetch(url, init)
let baseUrl = getApiBaseUrl()

/**
 * Replace the transport. Tests pass an in-memory `fetcher` (or an axios-shaped
 * `client`, adapted with `axiosFetcher`) and a fake `storageFetch`.
 */
export function configureHttp(options: {
  fetcher?: HttpFetcher
  client?: AxiosInstance
  storageFetch?: StorageFetch
  baseUrl?: string
}): void {
  if (options.client) fetcher = axiosFetcher(options.client)
  if (options.fetcher) fetcher = options.fetcher
  if (options.storageFetch) storageFetch = options.storageFetch
  if (options.baseUrl) baseUrl = options.baseUrl
}

function parseProblemCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function parseRetryAfter(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function errorFromResponse(response: HttpResponse): ApiError {
  return new ApiError(
    response.status,
    parseRetryAfter(response.headers?.['retry-after']),
    parseProblemCode(response.data),
  )
}

/** Send through the fetcher; a network failure becomes an ApiError without status. */
async function exchange(request: HttpRequest): Promise<HttpResponse> {
  try {
    return await fetcher(request)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError()
  }
}

/** Parse a response body, turning a shape mismatch into an ApiError. */
function parseBody<T>(schema: ZodType<T>, data: unknown, status: number): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new ApiError(status)
  return result.data
}

/** CSRF proof from `GET /auth/csrf`; the header name must be a valid HTTP token. */
const csrfSchema = z.object({
  headerName: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  token: z.string().min(1),
})

type CsrfProof = z.infer<typeof csrfSchema>

async function getCsrfProof(): Promise<CsrfProof> {
  const response = await exchange({
    method: 'get',
    url: `${baseUrl}/auth/csrf`,
    headers: { Accept: 'application/json' },
  })
  if (response.status >= 400) throw errorFromResponse(response)
  return parseBody(csrfSchema, response.data, response.status)
}

/** Share one in-flight call between concurrent callers; a new call starts once it settles. */
export function shareInFlight(task: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | undefined
  return () => {
    inFlight ??= task().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }
}

/**
 * Refresh the session, sharing a single request between concurrent callers.
 * Refresh rotates the refresh token, so a second parallel refresh would send
 * the old token and the backend would revoke the session as reuse.
 */
export const sharedRefresh = shareInFlight(async () => {
  await sendWithCsrf('post', '/auth/refresh', undefined, 204)
})

const sessionExpiredListeners = new Set<() => void>()

/** Be told when a business call found the session gone and refresh failed. Returns an unsubscribe. */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

/**
 * Business calls only: the auth endpoints report their own 401s (wrong
 * password, unusable link) and refreshing for them would loop or rotate the
 * session for nothing.
 */
function refreshesOnUnauthorized(path: string): boolean {
  return !path.startsWith('/auth/')
}

/**
 * After a 401 on a business call: refresh once (shared) so the caller can
 * retry. When the refresh fails the session is over: tell the listeners and
 * rethrow the original 401.
 */
async function refreshAfterUnauthorized(unauthorized: ApiError): Promise<void> {
  try {
    await sharedRefresh()
  } catch {
    for (const listener of sessionExpiredListeners) listener()
    throw unauthorized
  }
}

export type UnsafeMethod = 'post' | 'put' | 'patch' | 'delete'

/**
 * Send an unsafe request with a fresh CSRF proof and expect `expectedStatus`.
 * A 403 may mean the proof was missing or rejected, so refetch it and retry
 * exactly once. A 401 on a business path refreshes the session and retries
 * exactly once. Resolves with the response body.
 */
export async function sendWithCsrf(
  method: UnsafeMethod,
  path: string,
  body: unknown,
  expectedStatus: number,
): Promise<unknown> {
  let csrfRetried = false
  let refreshed = !refreshesOnUnauthorized(path)
  for (;;) {
    const proof = await getCsrfProof()
    const response = await exchange({
      method,
      url: `${baseUrl}${path}`,
      body,
      headers: {
        Accept: 'application/problem+json, application/json',
        [proof.headerName]: proof.token,
      },
    })
    if (response.status === expectedStatus) return response.data
    const error = errorFromResponse(response)
    if (error.status === 403 && !csrfRetried) {
      csrfRetried = true
      continue
    }
    if (error.status === 401 && !refreshed) {
      refreshed = true
      await refreshAfterUnauthorized(error)
      continue
    }
    throw error
  }
}

/**
 * GET a JSON resource under the API base URL with the session cookies and
 * parse it. A 401 on a business path refreshes the session and retries
 * exactly once.
 */
export async function getJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  let refreshed = !refreshesOnUnauthorized(path)
  for (;;) {
    const response = await exchange({
      method: 'get',
      url: `${baseUrl}${path}`,
      headers: { Accept: 'application/json' },
    })
    if (response.status === 200) return parseBody(schema, response.data, response.status)
    const error = errorFromResponse(response)
    if (error.status === 401 && !refreshed) {
      refreshed = true
      await refreshAfterUnauthorized(error)
      continue
    }
    throw error
  }
}

/** POST/PUT/PATCH JSON with CSRF proof, expect `expectedStatus` and parse the body. */
export async function sendJson<T>(
  method: Exclude<UnsafeMethod, 'delete'>,
  path: string,
  body: unknown,
  expectedStatus: number,
  schema: ZodType<T>,
): Promise<T> {
  const data = await sendWithCsrf(method, path, body, expectedStatus)
  return parseBody(schema, data, expectedStatus)
}

/** DELETE with CSRF proof (same single retry after a 403 or a 401); expects 204 by default. */
export async function deleteJson(path: string, expectedStatus = 204): Promise<void> {
  await sendWithCsrf('delete', path, undefined, expectedStatus)
}

/** Run a presigned transfer; a network failure or a non-2xx answer becomes an ApiError. */
async function storageTransfer(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await storageFetch(url, init)
  } catch {
    throw new ApiError()
  }
  if (!response.ok) throw new ApiError(response.status)
  return response
}

/**
 * Download a presigned storage URL (S3 GET). Throws ApiError on a non-2xx
 * answer, e.g. an expired link, instead of returning the error page as a file.
 */
export async function downloadPresigned(url: string): Promise<Blob> {
  const response = await storageTransfer(url)
  return response.blob()
}

/**
 * Upload a file to a presigned storage URL (S3 PUT) with the headers the
 * backend signed. Throws ApiError on a non-2xx answer, so callers never
 * confirm an upload that was not stored.
 */
export async function uploadPresigned(
  url: string,
  file: Blob,
  headers: Record<string, string> = {},
): Promise<void> {
  await storageTransfer(url, { method: 'PUT', headers, body: file })
}

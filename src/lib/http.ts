import axios, { type AxiosInstance } from 'axios'
import { z, type ZodType } from 'zod'
import { getApiBaseUrl } from '../config/env'

/**
 * The dashboard's one HTTP client for the backend API: JSON transport, CSRF
 * proof (one retry, only for a `CSRF_INVALID` 403), session refresh after a 401
 * (one retry), and `ApiError` for every failure. Security guards: every API URL
 * goes through `buildApiUrl` (only safe paths get cookies), requests time out
 * after `REQUEST_TIMEOUT_MS`, and presigned storage URLs go through
 * `assertPresignedUrl` (HTTPS, never the API origin). Presigned storage
 * transfers (S3 GET/PUT) skip cookies and CSRF.
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
  /**
   * The whole problem body, for rule-specific properties next to `code` (for
   * example `action` and `requires` of `ROLE_DEPENDENCY_MISSING`). Empty when
   * the body was not a JSON object.
   */
  readonly problem: Readonly<Record<string, unknown>>

  constructor(status?: number, retryAfterSeconds?: number, code?: string, problem: Record<string, unknown> = {}) {
    super('API request failed')
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.code = code
    this.problem = problem
  }

  /** A string property of the problem body, or undefined when absent or not a string. */
  problemString(name: string): string | undefined {
    const value = this.problem[name]
    return typeof value === 'string' ? value : undefined
  }

  /** A finite number property of the problem body, or undefined when absent or not a number. */
  problemNumber(name: string): number | undefined {
    const value = this.problem[name]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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

/**
 * Upper bound for one API request, so a hung connection cannot hold a shared
 * refresh or a button's busy state forever. Presigned storage transfers are
 * not bound by it: a large plan upload may legitimately take longer.
 */
export const REQUEST_TIMEOUT_MS = 30_000

/** The real fetcher: an axios instance with `withCredentials`. */
export function axiosFetcher(client: AxiosInstance): HttpFetcher {
  return async ({ method, url, body, headers }) => {
    const config = { withCredentials: true, headers, timeout: REQUEST_TIMEOUT_MS }
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

/** True when the text holds a C0 control character or DEL (such as a line break). */
function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * True for a path that can only name a resource under the API base: a single
 * leading `/`, no protocol-relative `//`, no `.`/`..` segments, no backslash
 * or control character. The query string and fragment are not inspected.
 */
function isSafeApiPath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('\\') || hasControlCharacter(path)) return false
  const [pathOnly] = path.split(/[?#]/)
  if (pathOnly.includes('//')) return false
  return !pathOnly.split('/').some((segment) => segment === '.' || segment === '..')
}

/**
 * The only way a request URL is built. Credentials (cookies and the CSRF
 * header) go only to URLs that pass here, so a malformed path never reaches the
 * fetcher. Throws an ApiError without a status, like any other network failure.
 */
export function buildApiUrl(path: string): string {
  if (!isSafeApiPath(path)) throw new ApiError()
  return `${baseUrl}${path}`
}

const LOCAL_STORAGE_HOSTS = new Set(['localhost', '127.0.0.1'])

/**
 * Guard for presigned storage URLs, which come from the backend. Only HTTPS
 * (or plain HTTP to a local stand-in for S3), no embedded credentials, and
 * never the API's own origin: the API's cookies must not be sent to storage.
 */
export function assertPresignedUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ApiError()
  }
  const schemeAllowed =
    parsed.protocol === 'https:' || (parsed.protocol === 'http:' && LOCAL_STORAGE_HOSTS.has(parsed.hostname))
  if (!schemeAllowed || parsed.username || parsed.password) throw new ApiError()
  const apiOrigin = new URL(baseUrl, globalThis.location?.href ?? 'http://localhost').origin
  if (parsed.origin === apiOrigin) throw new ApiError()
}

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

function parseProblem(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
}

function parseRetryAfter(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function errorFromResponse(response: HttpResponse): ApiError {
  const problem = parseProblem(response.data)
  return new ApiError(
    response.status,
    parseRetryAfter(response.headers?.['retry-after']),
    typeof problem.code === 'string' ? problem.code : undefined,
    problem,
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
    url: buildApiUrl('/auth/csrf'),
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
  const url = buildApiUrl(path)
  let csrfRetried = false
  let refreshed = !refreshesOnUnauthorized(path)
  for (;;) {
    const proof = await getCsrfProof()
    const response = await exchange({
      method,
      url,
      body,
      headers: {
        Accept: 'application/problem+json, application/json',
        [proof.headerName]: proof.token,
      },
    })
    if (response.status === expectedStatus) return response.data
    const error = errorFromResponse(response)
    // Only a rejected CSRF proof is worth a retry. A plain FORBIDDEN is a
    // permission decision and would fail the same way again.
    if (error.status === 403 && error.code === 'CSRF_INVALID' && !csrfRetried) {
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
  const url = buildApiUrl(path)
  let refreshed = !refreshesOnUnauthorized(path)
  for (;;) {
    const response = await exchange({
      method: 'get',
      url,
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
  assertPresignedUrl(url)
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

/** The part of `XMLHttpRequest` an upload uses, so tests can fake it. */
export type StorageRequest = Pick<
  XMLHttpRequest,
  'status' | 'withCredentials' | 'upload' | 'onload' | 'onerror' | 'open' | 'setRequestHeader' | 'send'
>

/**
 * PUT a file to a presigned storage URL with progress (0 to 1). XHR is used
 * because `fetch` cannot report upload progress. Sent with no cookies and no
 * CSRF header. The URL is checked before a request object exists. Rejects with
 * ApiError: its status for a storage answer, none for a network failure.
 */
export async function uploadPresignedWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
  createRequest: () => StorageRequest = () => new XMLHttpRequest(),
): Promise<void> {
  assertPresignedUrl(url)
  return new Promise((resolve, reject) => {
    const request = createRequest()
    request.open('PUT', url)
    request.withCredentials = false
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new ApiError(request.status))
      }
    }
    request.onerror = () => reject(new ApiError())
    request.send(body)
  })
}

import { ApiError, getJson, sendWithCsrf } from '../../lib/http'
import { userSchema, type CurrentUser, type LoginInput, type RegistrationInput } from './schemas'

/** @deprecated Use `ApiError` from `lib/http`. Kept as an alias during migration. */
export { ApiError as AuthApiError }
/** @deprecated Use `configureHttp` from `lib/http`. Kept for older tests. */
export { configureHttp as configureAuthApi } from '../../lib/http'
export { onSessionExpired, shareInFlight, sharedRefresh } from '../../lib/http'

async function postWithCsrf(path: string, body: unknown, expectedStatus: number): Promise<void> {
  await sendWithCsrf('post', path, body, expectedStatus)
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

/** Fetch the authenticated user. Throws ApiError with `status` 401 when unauthenticated. */
export function getCurrentUser(): Promise<CurrentUser> {
  return getJson('/auth/me', userSchema)
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


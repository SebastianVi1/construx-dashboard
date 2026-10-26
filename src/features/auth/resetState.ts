import { AuthApiError } from './authApi'

export type ResetFailure =
  | { kind: 'invalidLink' }
  | { kind: 'password' }
  | { kind: 'rateLimited'; retryAfterSeconds: number | undefined }
  | { kind: 'generic' }

/** The one-time reset token from the link, or an empty string when absent. */
export function readResetToken(params: URLSearchParams): string {
  return (params.get('token') ?? '').trim()
}

/** Map a failed password reset to the state the reset page shows. */
export function resetFailure(error: unknown): ResetFailure {
  if (!(error instanceof AuthApiError)) return { kind: 'generic' }
  if (error.status === 401) return { kind: 'invalidLink' }
  if (error.status === 400) return { kind: 'password' }
  if (error.status === 429) return { kind: 'rateLimited', retryAfterSeconds: error.retryAfterSeconds }
  return { kind: 'generic' }
}

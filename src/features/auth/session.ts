import { AuthApiError, getCurrentUser, refresh } from './authApi'
import type { CurrentUser } from './schemas'

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

/** Refresh the session, sharing a single request between concurrent callers. */
export const sharedRefresh = shareInFlight(refresh)

export type RestoreResult =
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unauthenticated' }

/**
 * Restore the session on app load: call `/me`, and on a 401 try `/refresh`
 * exactly once before retrying `/me`. A failed refresh (or any non-401
 * failure) resolves to unauthenticated so callers never retry refresh forever.
 */
export async function restoreSession(
  getCurrentUserFn: () => Promise<CurrentUser> = getCurrentUser,
  refreshFn: () => Promise<void> = sharedRefresh,
): Promise<RestoreResult> {
  try {
    const user = await getCurrentUserFn()
    return { status: 'authenticated', user }
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) {
      return { status: 'unauthenticated' }
    }
    try {
      await refreshFn()
      const user = await getCurrentUserFn()
      return { status: 'authenticated', user }
    } catch {
      return { status: 'unauthenticated' }
    }
  }
}

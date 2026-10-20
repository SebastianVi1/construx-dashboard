import { AuthApiError, getCurrentUser, refresh } from './authApi'
import type { CurrentUser } from './schemas'

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
  refreshFn: () => Promise<void> = refresh,
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

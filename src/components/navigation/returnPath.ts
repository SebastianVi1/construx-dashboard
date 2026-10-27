const STORAGE_KEY = 'construx.returnTo'

/**
 * An in-app path to return to after signing in (for example an invitation
 * link), or null. Only same-origin absolute paths pass, so `next` can never
 * send the user to another site.
 */
export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  // Backslashes and control characters (tab, newline) are normalized away by URL
  // parsers, so `/\t/evil` would become `//evil`: reject them outright.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

/** `/login?next=...` (or `/register?...`), or the bare page without a return path. */
export function withReturnPath(page: '/login' | '/register', next: string | null): string {
  const path = safeReturnPath(next)
  return path ? `${page}?next=${encodeURIComponent(path)}` : page
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Keep the return path across a full-page redirect (Google sign-in). */
export function rememberReturnPath(storage: Storage, path: string): void {
  try {
    storage.setItem(STORAGE_KEY, path)
  } catch {
    // Without storage the user lands on the default page instead.
  }
}

/**
 * The remembered return path. Reading does not remove it, so a render or a
 * StrictMode double effect sees the same value; call `forgetReturnPath` once
 * the user was sent there.
 */
export function readReturnPath(storage: Storage): string | null {
  try {
    return safeReturnPath(storage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function forgetReturnPath(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up without storage.
  }
}

/**
 * At registration: keep a valid `next` (an invitation link) until the user has
 * verified their email and signed in, or clear a stale one. Pass localStorage,
 * because the verification link may open in a new tab.
 */
export function rememberAcrossVerification(storage: Storage, next: string | null): void {
  const path = safeReturnPath(next)
  if (path) rememberReturnPath(storage, path)
  else forgetReturnPath(storage)
}

/** Sign-in link shown after a successful verification, carrying the remembered path. */
export function verifiedSignInPath(storage: Storage): string {
  return withReturnPath('/login', readReturnPath(storage))
}

/**
 * Where a signed-out user on a protected page goes. After an expired session
 * they come back to the page they were on; a fresh visitor gets plain login.
 */
export function loginRedirect(currentPath: string, sessionExpired: boolean): string {
  return sessionExpired ? withReturnPath('/login', currentPath) : '/login'
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentUser, logout as logoutApi, onSessionExpired } from './authApi'
import { restoreSession } from './session'
import { AuthContext, type AuthStatus } from './auth-context'
import type { CurrentUser } from './schemas'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const startedRef = useRef(false)

  // A business call got a 401 and the silent refresh failed: the session is
  // over, so route guards send the user to sign in and back to this page.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null)
        setStatus('unauthenticated')
        setSessionExpired(true)
      }),
    [],
  )

  useEffect(() => {
    // Run the restore exactly once per mount. Refresh rotates the refresh
    // secret, so a double invoke (StrictMode) must not fire it twice.
    if (startedRef.current) return
    startedRef.current = true

    restoreSession().then((result) => {
      if (result.status === 'authenticated') {
        setUser(result.user)
        setStatus('authenticated')
      } else {
        setStatus('unauthenticated')
      }
    })
  }, [])

  async function signIn() {
    const nextUser = await getCurrentUser()
    setUser(nextUser)
    setStatus('authenticated')
    setSessionExpired(false)
  }

  async function signOut() {
    try {
      await logoutApi()
    } catch {
      // The session may already be gone; clear local state regardless.
    }
    setUser(null)
    setStatus('unauthenticated')
    setSessionExpired(false)
  }

  return (
    <AuthContext.Provider value={{ status, user, sessionExpired, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

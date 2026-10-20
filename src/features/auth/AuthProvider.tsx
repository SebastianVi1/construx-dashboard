import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentUser, logout as logoutApi } from './authApi'
import { restoreSession } from './session'
import { AuthContext, type AuthStatus } from './auth-context'
import type { CurrentUser } from './schemas'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const startedRef = useRef(false)

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
  }

  async function signOut() {
    try {
      await logoutApi()
    } catch {
      // The session may already be gone; clear local state regardless.
    }
    setUser(null)
    setStatus('unauthenticated')
  }

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

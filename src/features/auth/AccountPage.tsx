import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'

/**
 * Minimal post-login landing. HomePage stays unrouted; this page is the only
 * protected surface and shows the signed-in identity plus a sign-out action.
 */
export function AccountPage() {
  const { status, user, signOut } = useAuth()

  useEffect(() => {
    document.title = 'Your account | Construx'
  }, [])

  if (status === 'loading') {
    return (
      <AuthLayout title="Your account" description="Checking your session…">
        <div className="auth-loading" role="status">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />
  }

  return (
    <AuthLayout title="Your account" description="You are signed in to Construx.">
      <div className="auth-account">
        <p>
          Signed in as <span className="auth-account__email">{user.email}</span>
        </p>
        <button type="button" className="auth-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </AuthLayout>
  )
}

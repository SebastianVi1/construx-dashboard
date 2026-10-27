import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { useLocale } from '../../i18n'
import { wantsAccountPage } from '../organizations/navigation'

/**
 * Signed-in identity plus a sign-out action. Sign-in flows land here; inside
 * `OrganizationGate` that means the user has a company, so they move on to the
 * sites list unless they opened this page from the workspace navigation.
 */
export function AccountPage() {
  const { status, user, signOut } = useAuth()
  const { messages: m } = useLocale()
  const location = useLocation()
  const stay = wantsAccountPage(location.state)

  useEffect(() => {
    document.title = `${m.auth.title.account} | Construx`
  }, [m])

  if (status === 'loading') {
    return (
      <AuthLayout title={m.auth.title.account} description={m.auth.account.checking}>
        <div className="auth-loading" role="status">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>{m.auth.account.loading}</span>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />
  }

  if (!stay) return <Navigate to="/sites" replace />

  return (
    <AuthLayout title={m.auth.title.account} description={m.auth.description.account}>
      <div className="auth-account">
        <p>
          {m.auth.account.signedInAs} <span className="auth-account__email">{user.email}</span>
        </p>
        <Link className="org-primary" to="/sites">
          {m.workspace.toSites}
        </Link>
        <button type="button" className="auth-signout" onClick={() => void signOut()}>
          {m.auth.account.signOut}
        </button>
      </div>
    </AuthLayout>
  )
}

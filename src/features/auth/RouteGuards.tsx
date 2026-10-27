import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { loginRedirect, safeReturnPath } from '../../components/navigation/returnPath'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { useLocale } from '../../i18n'

function SessionLoading() {
  const { messages: m } = useLocale()

  return (
    <AuthLayout title={m.auth.title.account} description={m.auth.account.checking}>
      <div className="auth-loading" role="status">
        <span className="auth-loading__spinner" aria-hidden="true" />
        <span>{m.auth.account.loading}</span>
      </div>
    </AuthLayout>
  )
}

/**
 * Render children only for a signed-in user; otherwise send them to login.
 * After an expired session they come back to this page once signed in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, sessionExpired } = useAuth()
  const { pathname, search } = useLocation()

  if (status === 'loading') return <SessionLoading />
  if (status === 'unauthenticated') return <Navigate to={loginRedirect(`${pathname}${search}`, sessionExpired)} replace />
  return children
}

/**
 * Render children only for a visitor. A signed-in user goes to the `?next=`
 * page when it is an in-app path (an invitation link), else to the workspace
 * home, which picks the landing screen for their role.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()

  if (status === 'loading') return <SessionLoading />
  if (status === 'authenticated') return <Navigate to={safeReturnPath(searchParams.get('next')) ?? '/'} replace />
  return children
}

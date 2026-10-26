import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
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

/** Render children only for a signed-in user; otherwise send them to login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return children
}

/** Render children only for a visitor; a signed-in user goes to the account page. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <SessionLoading />
  if (status === 'authenticated') return <Navigate to="/account" replace />
  return children
}

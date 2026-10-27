import type { ReactNode } from 'react'
import { useLocale } from '../../i18n'
import { AuthLayout } from '../auth/AuthLayout'
import { NoOrganization } from './NoOrganization'
import { useOrganizations } from './organizations-context'
import './organizations.css'

/**
 * Wraps protected screens that need a company. It never renders the screen
 * before the organization list is known and shows the empty state when the
 * user has none. Use inside `RequireAuth`.
 */
export function OrganizationGate({ children }: { children: ReactNode }) {
  const { status, organizations, reload } = useOrganizations()
  const { messages: m } = useLocale()

  if (status === 'error') {
    return (
      <AuthLayout title={m.organizations.empty.title} description={m.organizations.loadError}>
        <button type="button" className="org-primary" onClick={reload}>
          {m.organizations.retry}
        </button>
      </AuthLayout>
    )
  }

  if (status !== 'ready') {
    // The description already says what is loading; the spinner is decoration.
    return (
      <AuthLayout title={m.organizations.empty.title} description={m.organizations.loading}>
        <div className="auth-loading" aria-hidden="true">
          <span className="auth-loading__spinner" />
        </div>
      </AuthLayout>
    )
  }

  if (organizations.length === 0) return <NoOrganization />

  return <div className="org-frame">{children}</div>
}

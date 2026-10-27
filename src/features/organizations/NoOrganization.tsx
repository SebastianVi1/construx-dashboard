import { useState } from 'react'
import { Link } from 'react-router'
import { formatMessage, useLocale } from '../../i18n'
import { useAuth } from '../auth/auth-context'
import { AuthLayout } from '../auth/AuthLayout'
import { useOnboarding } from '../onboarding'

/**
 * Shown to a signed-in user with no organization. A worker or invited user is
 * told to wait for an invitation (joining is out of this screen's scope);
 * everyone else is offered to create the company.
 */
export function NoOrganization() {
  const { user, signOut } = useAuth()
  const { intent } = useOnboarding()
  const { messages: m } = useLocale()
  const t = m.organizations.empty
  const worker = intent === 'WORKER_OR_INVITED'
  const [signingOut, setSigningOut] = useState(false)

  const leave = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <AuthLayout title={t.title} description={worker ? t.workerHeading : t.ownerHeading}>
      <div className="org-empty">
        {worker ? (
          <>
            <p className="org-empty__body">{formatMessage(t.workerBody, { email: user?.email ?? '' })}</p>
            <Link className="org-empty__secondary" to="/organizations/new">
              {t.workerAction}
            </Link>
          </>
        ) : (
          <>
            <p className="org-empty__body">{t.ownerBody}</p>
            <Link className="org-primary" to="/organizations/new">
              {t.ownerAction}
            </Link>
            <p className="org-empty__hint">{t.inviteHint}</p>
          </>
        )}
        <button type="button" className="auth-signout" disabled={signingOut} onClick={() => void leave()}>
          {signingOut ? m.auth.account.signingOut : m.auth.account.signOut}
        </button>
      </div>
    </AuthLayout>
  )
}

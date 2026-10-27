import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { withReturnPath } from '../../components/navigation/returnPath'
import { formatMessage, useLocale } from '../../i18n'
import { AuthApiError } from '../auth/authApi'
import { useAuth } from '../auth/auth-context'
import { AuthLayout } from '../auth/AuthLayout'
import { rateLimitText } from '../auth/retryAfter'
import { useOrganizations } from '../organizations/organizations-context'
import { acceptErrorKind, acceptInvitation, joinedPath, type AcceptErrorKind } from './invitationsApi'
import '../organizations/organizations.css'

type Failure = { kind: AcceptErrorKind; retryAfterSeconds?: number }

/**
 * `/invitations/accept?token=...` from the invitation email. Signed out, it
 * links to sign-in and registration with this URL as the return path; signed
 * in, the user accepts explicitly, then lands on the joined site or workspace.
 * The token stays in the URL only and is never logged.
 */
export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { status, user, signOut } = useAuth()
  const organizations = useOrganizations()
  const { messages: m } = useLocale()
  const t = m.invitations
  const token = searchParams.get('token') ?? ''
  const here = `${location.pathname}${location.search}`
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  async function accept() {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      const accepted = await acceptInvitation(token)
      organizations.select(accepted.organization.id)
      organizations.reload()
      navigate(joinedPath(accepted), { replace: true })
    } catch (error) {
      setFailure({
        kind: acceptErrorKind(error),
        retryAfterSeconds: error instanceof AuthApiError ? error.retryAfterSeconds : undefined,
      })
      setBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthLayout title={t.title} description={t.description}>
        <div className="auth-loading" role="status">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>{m.auth.account.loading}</span>
        </div>
      </AuthLayout>
    )
  }

  if (!token) {
    return (
      <AuthLayout title={t.title} description={t.description}>
        <p className="form-error" role="alert">
          {t.missingToken}
        </p>
        <p className="auth-switch">
          <Link to="/">{t.toWorkspace}</Link>
        </p>
      </AuthLayout>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <AuthLayout title={t.title} description={t.description}>
        <p className="org-empty__body">{t.signedOut}</p>
        <Link className="org-primary" to={withReturnPath('/login', here)}>
          {t.signIn}
        </Link>
        <p className="auth-switch">
          <Link to={withReturnPath('/register', here)}>{t.register}</Link>
        </p>
      </AuthLayout>
    )
  }

  const message = failure
    ? failure.kind === 'rateLimited'
      ? rateLimitText(m.auth.error, failure.retryAfterSeconds)
      : t.error[failure.kind]
    : null

  return (
    <AuthLayout title={t.title} description={t.description}>
      <p className="org-empty__body">{formatMessage(t.signedInAs, { email: user?.email ?? '' })}</p>
      <div className="form-feedback" aria-live="polite" aria-atomic="true">
        {message ? (
          <p className="form-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
      {failure?.kind === 'session' ? (
        <Link className="org-primary" to={withReturnPath('/login', here)}>
          {t.signIn}
        </Link>
      ) : (
        <button type="button" className="org-primary" onClick={() => void accept()} disabled={busy}>
          {busy ? t.pending : t.accept}
        </button>
      )}
      <button type="button" className="auth-signout" onClick={() => void signOut()} disabled={busy}>
        {t.switchAccount}
      </button>
    </AuthLayout>
  )
}

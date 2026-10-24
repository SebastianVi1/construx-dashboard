import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { verifyEmail } from './authApi'
import { AuthLayout } from './AuthLayout'
import { useLocale } from '../../i18n'

type VerifyState = 'submitting' | 'success' | 'error'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [state, setState] = useState<VerifyState>(token ? 'submitting' : 'error')
  const submittedRef = useRef(false)
  const { messages: m } = useLocale()

  useEffect(() => {
    document.title = `${m.auth.title.verify} | Construx`
  }, [m])

  useEffect(() => {
    // A one-time token must be sent exactly once, even under StrictMode's
    // double effect invocation in development.
    if (submittedRef.current || !token) return
    submittedRef.current = true
    verifyEmail(token)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [token])

  if (state === 'submitting') {
    return (
      <AuthLayout title={m.auth.title.verify} description={m.auth.description.verify}>
        <div className="auth-loading" role="status">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>{m.auth.pending.verify}</span>
        </div>
      </AuthLayout>
    )
  }

  if (state === 'success') {
    return (
      <AuthLayout title={m.auth.title.verifySuccess} description={m.auth.description.verifySuccess}>
        <div className="auth-status">
          <p role="status">{m.auth.verifyStatus}</p>
        </div>
        <p className="auth-switch"><Link to="/login">{m.auth.switch.loginLink}</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={m.auth.title.verifyFailed} description={m.auth.description.verifyFailed}>
      <div className="auth-status">
        <p role="alert">{m.auth.verifyFailedBody}</p>
      </div>
      <p className="auth-switch">
        <Link to="/register">{m.auth.verifyRegisterLink}</Link>
        {' · '}
        <Link to="/login">{m.auth.switch.loginLink}</Link>
      </p>
    </AuthLayout>
  )
}

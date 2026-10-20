import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { verifyEmail } from './authApi'
import { AuthLayout } from './AuthLayout'

type VerifyState = 'submitting' | 'success' | 'error'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [state, setState] = useState<VerifyState>(token ? 'submitting' : 'error')
  const submittedRef = useRef(false)

  useEffect(() => {
    document.title = 'Verify your email | Construx'
  }, [])

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
      <AuthLayout title="Verify your email" description="Confirming your verification link…">
        <div className="auth-loading" role="status">
          <span className="auth-loading__spinner" aria-hidden="true" />
          <span>Verifying your email…</span>
        </div>
      </AuthLayout>
    )
  }

  if (state === 'success') {
    return (
      <AuthLayout title="Email verified" description="Your email address is confirmed. You can now sign in.">
        <div className="auth-status">
          <p role="status">Verification successful.</p>
        </div>
        <p className="auth-switch"><Link to="/login">Sign in</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Verification failed"
      description="This link is invalid or has already been used."
    >
      <div className="auth-status">
        <p role="alert">
          The verification link is expired or was already used. Verification links work once and
          expire after 24 hours.
        </p>
      </div>
      <p className="auth-switch">
        <Link to="/register">Create an account</Link>
        {' · '}
        <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

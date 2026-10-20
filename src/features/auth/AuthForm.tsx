import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { login, register, resendVerification } from './authApi'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { loginSchema, registrationSchema } from './schemas'
import { getOAuth2AuthorizationUrl } from '../../config/env'

type AuthMode = 'login' | 'register'
type ResendStatus = 'idle' | 'sending' | 'sent' | 'error'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegistration = mode === 'register'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle')

  const googleError = !isRegistration && searchParams.get('error') === 'google'
  const googleAuthorizationUrl = isRegistration ? '' : getOAuth2AuthorizationUrl()

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema: isRegistration ? registrationSchema : loginSchema,
    onSubmit: async (data) => {
      if (isRegistration) {
        await register(data)
        setRegisteredEmail(data.email)
        setAccepted(true)
      } else {
        await login(data)
        await signIn()
        navigate('/account', { replace: true })
      }
    },
    onInvalid: (errors) => {
      const firstError = ['email', 'password'].find((name) => errors[name])
      if (firstError) document.getElementById(`field-${firstError}`)?.focus()
    },
  })

  useEffect(() => {
    document.title = `${accepted ? 'Check your email' : isRegistration ? 'Create an account' : 'Sign in'} | Construx`
  }, [accepted, isRegistration])

  async function handleResend() {
    setResendStatus('sending')
    try {
      await resendVerification(registeredEmail)
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  const fields: FieldConfig[] = [
    {
      name: 'email',
      label: 'Email address',
      type: 'email',
      placeholder: 'you@example.com',
      autoComplete: 'email',
      inputMode: 'email',
      spellCheck: false,
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      autoComplete: isRegistration ? 'new-password' : 'current-password',
      hint: isRegistration ? 'Use at least 12 characters.' : undefined,
    },
  ]

  if (accepted) {
    return (
      <AuthLayout
        title="Check your email"
        description="If this address can receive a verification email, follow the instructions there to finish creating your account."
      >
        <div className="auth-accepted" role="status">
          <p>You can return to sign in after verifying your email.</p>
        </div>
        <div className="auth-resend">
          {resendStatus === 'sent' ? (
            <p className="auth-resend__sent" role="status">Verification email sent. Check your inbox.</p>
          ) : (
            <>
              <p className="auth-resend__hint">Didn&apos;t receive the email?</p>
              <button
                type="button"
                className="auth-resend__button"
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendStatus === 'error' && (
                <p className="form-error" role="alert">We could not resend the email. Please try again.</p>
              )}
            </>
          )}
        </div>
        <p className="auth-switch"><Link to="/login">Sign in</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={isRegistration ? 'Create an account' : 'Sign in'}
      description={isRegistration
        ? 'Enter your details to request an account. You will verify your email before signing in.'
        : 'Enter your account details to return to your workspace.'}
    >
      {googleError && (
        <p className="form-error auth-google-error" role="alert">
          Google sign-in failed. Please try again or use your email and password.
        </p>
      )}

      <Form
        controller={form}
        fields={fields}
        submitLabel={isRegistration ? 'Create account' : 'Sign in'}
        pendingLabel={isRegistration ? 'Creating your account…' : 'Signing you in…'}
      >
        <div className="form-feedback" aria-live="polite" aria-atomic="true">
          {form.submitError && (
            <p className="form-error" role="alert">
              {isRegistration
                ? 'We could not complete your request. Please try again.'
                : 'We could not sign you in. Check your details and try again.'}
            </p>
          )}
        </div>
      </Form>

      {googleAuthorizationUrl && (
        <>
          <div className="auth-divider" role="separator"><span>or</span></div>
          <a className="auth-google" href={googleAuthorizationUrl}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26a5.43 5.43 0 0 1-8.1-2.85H.86v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.94 10.7a5.4 5.4 0 0 1 0-3.42V4.96H.86a9 9 0 0 0 0 8.08l3.08-2.34Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .86 4.96L3.94 7.3A5.4 5.4 0 0 1 9 3.58Z" />
            </svg>
            Continue with Google
          </a>
        </>
      )}

      <p className="auth-switch">
        {isRegistration ? 'Already have an account?' : 'New to Construx?'}{' '}
        <Link to={isRegistration ? '/login' : '/register'}>
          {isRegistration ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </AuthLayout>
  )
}

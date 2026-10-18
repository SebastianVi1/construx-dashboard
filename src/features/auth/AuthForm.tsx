import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { authApi } from './authApi'
import { AuthLayout } from './AuthLayout'
import { loginSchema, registrationSchema } from './schemas'

type AuthMode = 'login' | 'register'
type FieldName = 'email' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegistration = mode === 'register'
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'accepted'>('idle')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    document.title = `${status === 'accepted' ? 'Check your email' : isRegistration ? 'Create an account' : 'Sign in'} | Construx`
  }, [isRegistration, status])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    const parsed = (isRegistration ? registrationSchema : loginSchema).safeParse({ email, password })
    if (!parsed.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if ((field === 'email' || field === 'password') && !nextErrors[field]) {
          nextErrors[field] = issue.message
        }
      }
      setErrors(nextErrors)
      setStatus('idle')
      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    submittingRef.current = true
    setErrors({})
    setStatus('submitting')
    try {
      if (isRegistration) {
        await authApi.register(parsed.data)
        if (mountedRef.current) {
          setPassword('')
          setStatus('accepted')
        }
      } else {
        await authApi.login(parsed.data)
        if (mountedRef.current) {
          setPassword('')
          navigate('/', { replace: true })
        }
      }
    } catch {
      if (mountedRef.current) setStatus('error')
    } finally {
      submittingRef.current = false
    }
  }

  if (status === 'accepted') {
    return (
      <AuthLayout
        title="Check your email"
        description="If this address can receive a verification email, follow the instructions there to finish creating your account."
      >
        <div className="auth-accepted" role="status">
          <p>You can return to sign in after verifying your email.</p>
        </div>
        <p className="auth-switch"><Link to="/login">Sign in</Link></p>
      </AuthLayout>
    )
  }

  const pending = status === 'submitting'
  return (
    <AuthLayout
      title={isRegistration ? 'Create an account' : 'Sign in'}
      description={isRegistration
        ? 'Enter your details to request an account. You will verify your email before signing in.'
        : 'Enter your account details to return to your workspace.'}
    >
      <form className="auth-form" noValidate onSubmit={handleSubmit} aria-busy={pending}>
        <div className="auth-field">
          <label htmlFor={`${mode}-email`}>Email address</label>
          <input
            id={`${mode}-email`}
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors((current) => ({ ...current, email: undefined }))
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${mode}-email-error` : undefined}
            disabled={pending}
          />
          {errors.email && <p className="auth-field-error" id={`${mode}-email-error`}>{errors.email}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor={`${mode}-password`}>Password</label>
          <input
            id={`${mode}-password`}
            ref={passwordRef}
            type="password"
            name="password"
            autoComplete={isRegistration ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((current) => ({ ...current, password: undefined }))
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${mode}-password-error` : isRegistration ? `${mode}-password-hint` : undefined}
            disabled={pending}
          />
          {isRegistration && !errors.password && <p className="auth-field-hint" id={`${mode}-password-hint`}>Use at least 12 characters.</p>}
          {errors.password && <p className="auth-field-error" id={`${mode}-password-error`}>{errors.password}</p>}
        </div>

        <div className="auth-feedback" aria-live="polite" aria-atomic="true">
          {status === 'error' && (
            <p className="auth-request-error" role="alert">
              {isRegistration
                ? 'We could not complete your request. Please try again.'
                : 'We could not sign you in. Check your details and try again.'}
            </p>
          )}
          {pending && <p className="auth-progress">{isRegistration ? 'Creating your account…' : 'Signing you in…'}</p>}
        </div>

        <button className="auth-submit" type="submit" disabled={pending}>
          {isRegistration ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        {isRegistration ? 'Already have an account?' : 'New to Construx?'}{' '}
        <Link to={isRegistration ? '/login' : '/register'}>
          {isRegistration ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </AuthLayout>
  )
}

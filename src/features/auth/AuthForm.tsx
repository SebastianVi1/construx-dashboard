import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { authApi } from './authApi'
import { AuthLayout } from './AuthLayout'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { loginSchema, registrationSchema } from './schemas'

type AuthMode = 'login' | 'register'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegistration = mode === 'register'
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema: isRegistration ? registrationSchema : loginSchema,
    onSubmit: async (data) => {
      if (isRegistration) {
        await authApi.register(data)
        setAccepted(true)
      } else {
        await authApi.login(data)
        navigate('/', { replace: true })
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
        <p className="auth-switch"><Link to="/">Sign in</Link></p>
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

      <p className="auth-switch">
        {isRegistration ? 'Already have an account?' : 'New to Construx?'}{' '}
        <Link to={isRegistration ? '/' : '/register'}>
          {isRegistration ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </AuthLayout>
  )
}

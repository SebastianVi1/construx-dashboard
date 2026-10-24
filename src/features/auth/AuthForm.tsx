import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { login, register, resendVerification } from './authApi'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { makeLoginSchema, makeRegistrationSchema } from './schemas'
import { getOAuth2AuthorizationUrl } from '../../config/env'
import { useLocale } from '../../i18n'
import { QuestionModal } from '../../components/modal'
import { onboardingQuestion } from './onboarding'

type AuthMode = 'login' | 'register'
type ResendStatus = 'idle' | 'sending' | 'sent' | 'error'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegistration = mode === 'register'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useAuth()
  const { messages: m } = useLocale()
  const [accepted, setAccepted] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle')

  const googleError = !isRegistration && searchParams.get('error') === 'google'
  const googleAuthorizationUrl = isRegistration ? '' : getOAuth2AuthorizationUrl()

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema: isRegistration ? makeRegistrationSchema(m.validation) : makeLoginSchema(m.validation),
    onSubmit: async (data) => {
      if (isRegistration) {
        await register(data)
        setRegisteredEmail(data.email)
        setShowOnboarding(true)
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
    document.title = `${accepted ? m.auth.title.checkEmail : isRegistration ? m.auth.title.register : m.auth.title.signIn} | Construx`
  }, [accepted, isRegistration, m])

  async function handleResend() {
    setResendStatus('sending')
    try {
      await resendVerification(registeredEmail)
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  function handleOnboardingSubmit(optionId: string) {
    // The additional-information endpoint isn't defined yet; log for now and
    // wire the selected answer to the backend here once the contract exists.
    console.info('Onboarding answer:', optionId)
    setShowOnboarding(false)
    setAccepted(true)
  }

  function handleOnboardingSkip() {
    setShowOnboarding(false)
    setAccepted(true)
  }

  const fields: FieldConfig[] = [
    {
      name: 'email',
      label: m.auth.field.emailLabel,
      type: 'email',
      placeholder: m.auth.field.emailPlaceholder,
      autoComplete: 'email',
      inputMode: 'email',
      spellCheck: false,
    },
    {
      name: 'password',
      label: m.auth.field.passwordLabel,
      type: 'password',
      autoComplete: isRegistration ? 'new-password' : 'current-password',
      hint: isRegistration ? m.auth.field.passwordHint : undefined,
    },
  ]

  if (accepted) {
    return (
      <AuthLayout title={m.auth.title.checkEmail} description={m.auth.description.checkEmail}>
        <div className="auth-accepted" role="status">
          <p>{m.auth.accepted.body}</p>
        </div>
        <div className="auth-resend">
          {resendStatus === 'sent' ? (
            <p className="auth-resend__sent" role="status">{m.auth.accepted.sent}</p>
          ) : (
            <>
              <p className="auth-resend__hint">{m.auth.accepted.resendHint}</p>
              <button
                type="button"
                className="auth-resend__button"
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? m.auth.accepted.resendSending : m.auth.accepted.resendButton}
              </button>
              {resendStatus === 'error' && (
                <p className="form-error" role="alert">{m.auth.error.resend}</p>
              )}
            </>
          )}
        </div>
        <p className="auth-switch"><Link to="/login">{m.auth.accepted.signInLink}</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={isRegistration ? m.auth.title.register : m.auth.title.signIn}
      description={isRegistration ? m.auth.description.register : m.auth.description.signIn}
    >
      {showOnboarding && (
        <QuestionModal
          question={onboardingQuestion}
          submitLabel={m.onboarding.continue}
          onSubmit={handleOnboardingSubmit}
          onClose={handleOnboardingSkip}
        />
      )}

      {googleError && (
        <p className="form-error auth-google-error" role="alert">
          {m.auth.error.google}
        </p>
      )}

      <Form
        controller={form}
        fields={fields}
        submitLabel={isRegistration ? m.auth.submit.register : m.auth.submit.signIn}
        pendingLabel={isRegistration ? m.auth.pending.register : m.auth.pending.signIn}
      >
        <div className="form-feedback" aria-live="polite" aria-atomic="true">
          {form.submitError && (
            <p className="form-error" role="alert">
              {isRegistration ? m.auth.error.register : m.auth.error.signIn}
            </p>
          )}
        </div>
      </Form>

      {googleAuthorizationUrl && (
        <>
          <div className="auth-divider" role="separator"><span>{m.auth.divider}</span></div>
          <a className="auth-google" href={googleAuthorizationUrl}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26a5.43 5.43 0 0 1-8.1-2.85H.86v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.94 10.7a5.4 5.4 0 0 1 0-3.42V4.96H.86a9 9 0 0 0 0 8.08l3.08-2.34Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .86 4.96L3.94 7.3A5.4 5.4 0 0 1 9 3.58Z" />
            </svg>
            {m.auth.google}
          </a>
        </>
      )}

      <p className="auth-switch">
        {isRegistration ? m.auth.switch.toLogin : m.auth.switch.toRegister}{' '}
        <Link to={isRegistration ? '/login' : '/register'}>
          {isRegistration ? m.auth.switch.loginLink : m.auth.switch.registerLink}
        </Link>
      </p>
    </AuthLayout>
  )
}

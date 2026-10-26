import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AuthApiError, forgotPassword } from './authApi'
import { AuthLayout } from './AuthLayout'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { makeForgotPasswordSchema } from './schemas'
import { rateLimitText } from './retryAfter'
import { useLocale } from '../../i18n'

export function ForgotPasswordPage() {
  const { messages: m } = useLocale()
  const [sent, setSent] = useState(false)
  const [failure, setFailure] = useState<AuthApiError | null>(null)

  const form = useForm({
    initialValues: { email: '' },
    schema: makeForgotPasswordSchema(m.validation),
    onSubmit: async ({ email }) => {
      setFailure(null)
      try {
        await forgotPassword(email)
        // 202 for every address: never show different text per account.
        setSent(true)
      } catch (error) {
        setFailure(error instanceof AuthApiError ? error : new AuthApiError())
        throw error
      }
    },
    onInvalid: () => document.getElementById('field-email')?.focus(),
  })

  useEffect(() => {
    document.title = `${sent ? m.auth.recovery.sentTitle : m.auth.recovery.forgotTitle} | Construx`
  }, [sent, m])

  if (sent) {
    return (
      <AuthLayout title={m.auth.recovery.sentTitle} description={m.auth.recovery.sentDescription}>
        <div className="auth-status">
          <p role="status">{m.auth.recovery.sentBody}</p>
        </div>
        <p className="auth-switch"><Link to="/login">{m.auth.recovery.backToSignIn}</Link></p>
      </AuthLayout>
    )
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
  ]

  return (
    <AuthLayout title={m.auth.recovery.forgotTitle} description={m.auth.recovery.forgotDescription}>
      <Form
        controller={form}
        fields={fields}
        submitLabel={m.auth.recovery.forgotSubmit}
        pendingLabel={m.auth.recovery.forgotPending}
      >
        <div className="form-feedback" aria-live="polite" aria-atomic="true">
          {form.submitError && (
            <p className="form-error" role="alert">
              {failure?.status === 429
                ? rateLimitText(m.auth.error, failure.retryAfterSeconds)
                : m.auth.error.forgot}
            </p>
          )}
        </div>
      </Form>

      <p className="auth-switch"><Link to="/login">{m.auth.recovery.backToSignIn}</Link></p>
    </AuthLayout>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { resetPassword } from './authApi'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { makeResetPasswordSchema } from './schemas'
import { rateLimitText } from './retryAfter'
import { readResetToken, resetFailure, type ResetFailure } from './resetState'
import { useLocale } from '../../i18n'

type ResetView = 'form' | 'success' | 'invalid'

const fieldOrder = ['newPassword', 'confirmPassword']

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { status, signOut } = useAuth()
  const { messages: m } = useLocale()
  // Read the token once; it stays in state after the address bar is cleaned.
  const [token] = useState(() => readResetToken(searchParams))
  const [view, setView] = useState<ResetView>(token ? 'form' : 'invalid')
  const [failure, setFailure] = useState<ResetFailure | null>(null)

  useEffect(() => {
    // Keep the one-time credential out of history, screenshots and Referer.
    if (searchParams.has('token')) navigate('/reset-password', { replace: true })
  }, [searchParams, navigate])

  const form = useForm({
    initialValues: { newPassword: '', confirmPassword: '' },
    schema: makeResetPasswordSchema(m.validation),
    onSubmit: async ({ newPassword }) => {
      setFailure(null)
      try {
        await resetPassword(token, newPassword)
      } catch (error) {
        const next = resetFailure(error)
        if (next.kind === 'invalidLink') {
          setView('invalid')
          return
        }
        setFailure(next)
        throw error
      }
      // The backend revoked every session; drop any local one so /login is reachable.
      if (status === 'authenticated') await signOut()
      setView('success')
    },
    onInvalid: (errors) => {
      const firstError = fieldOrder.find((name) => errors[name])
      if (firstError) document.getElementById(`field-${firstError}`)?.focus()
    },
  })

  const title =
    view === 'success'
      ? m.auth.recovery.successTitle
      : view === 'invalid'
        ? m.auth.recovery.invalidTitle
        : m.auth.recovery.resetTitle

  useEffect(() => {
    document.title = `${title} | Construx`
  }, [title])

  if (view === 'success') {
    return (
      <AuthLayout title={title} description={m.auth.recovery.successDescription}>
        <div className="auth-status">
          <p role="status">{m.auth.recovery.successStatus}</p>
        </div>
        <p className="auth-switch"><Link to="/login">{m.auth.switch.loginLink}</Link></p>
      </AuthLayout>
    )
  }

  if (view === 'invalid') {
    return (
      <AuthLayout title={title} description={m.auth.recovery.invalidDescription}>
        <div className="auth-status">
          <p role="alert">{m.auth.recovery.invalidBody}</p>
        </div>
        <p className="auth-switch">
          <Link to="/forgot-password">{m.auth.recovery.requestNewLink}</Link>
        </p>
      </AuthLayout>
    )
  }

  const fields: FieldConfig[] = [
    {
      name: 'newPassword',
      label: m.auth.recovery.newPasswordLabel,
      type: 'password',
      autoComplete: 'new-password',
      revealLabels: { show: m.auth.field.showPassword, hide: m.auth.field.hidePassword },
      hint: m.auth.field.passwordHint,
    },
    {
      name: 'confirmPassword',
      label: m.auth.recovery.confirmPasswordLabel,
      type: 'password',
      autoComplete: 'new-password',
      revealLabels: { show: m.auth.field.showPassword, hide: m.auth.field.hidePassword },
    },
  ]

  function failureText(current: ResetFailure | null): string {
    if (current?.kind === 'rateLimited') return rateLimitText(m.auth.error, current.retryAfterSeconds)
    if (current?.kind === 'password') return m.auth.error.resetPassword
    return m.auth.error.reset
  }

  return (
    <AuthLayout title={title} description={m.auth.recovery.resetDescription}>
      <Form
        controller={form}
        fields={fields}
        submitLabel={m.auth.recovery.resetSubmit}
        pendingLabel={m.auth.recovery.resetPending}
      >
        <div className="form-feedback" aria-live="polite" aria-atomic="true">
          {form.submitError && (
            <p className="form-error" role="alert">{failureText(failure)}</p>
          )}
        </div>
      </Form>

      <p className="auth-switch"><Link to="/login">{m.auth.recovery.backToSignIn}</Link></p>
    </AuthLayout>
  )
}

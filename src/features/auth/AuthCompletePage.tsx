import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'
import { useLocale } from '../../i18n'

/**
 * Landing page after a successful Google OAuth redirect. The backend sets the
 * auth cookies and redirects here; the provider's app-load `/me` check runs on
 * mount, so this page just waits for the session state and routes accordingly.
 */
export function AuthCompletePage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const { messages: m } = useLocale()

  useEffect(() => {
    document.title = `${m.auth.title.complete} | Construx`
  }, [m])

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/account', { replace: true })
    } else if (status === 'unauthenticated') {
      navigate('/login?error=google', { replace: true })
    }
  }, [status, navigate])

  return (
    <AuthLayout title={m.auth.title.complete} description={m.auth.description.complete}>
      <div className="auth-loading" role="status">
        <span className="auth-loading__spinner" aria-hidden="true" />
        <span>{m.auth.pending.signIn}</span>
      </div>
    </AuthLayout>
  )
}

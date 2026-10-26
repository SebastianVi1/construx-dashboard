import { Link } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { useLocale } from '../../i18n'

export function NotFoundPage() {
  const { messages: m } = useLocale()

  return (
    <AuthLayout title={m.auth.notFound.title} description={m.auth.notFound.description}>
      <p>
        <Link to="/login">{m.auth.notFound.back}</Link>
      </p>
    </AuthLayout>
  )
}

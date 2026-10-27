import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LocaleSwitcher, useLocale } from '../../i18n'
import lockup from '../../assets/logo/lockup-horizontal-on-dark.svg'
import './auth.css'

type AuthLayoutProps = {
  title: string
  description: string
  children: ReactNode
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { messages: m } = useLocale()

  return (
    <main className="auth-page">
      <div className="auth-locale">
        <LocaleSwitcher />
      </div>
      <div className="auth-shell">
        <Link className="auth-brand" to="/" aria-label={m.auth.brandHome}>
          <img className="auth-brand-logo" src={lockup} alt="Construx" height="32" />
        </Link>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-header">
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </section>

      </div>
    </main>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './auth.css'

type AuthLayoutProps = {
  title: string
  description: string
  children: ReactNode
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link className="auth-brand" to="/" aria-label="Construx home">
          <span className="auth-brand-mark" aria-hidden="true">C</span>
          <span>Construx</span>
        </Link>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-header">
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </section>

        <Link className="auth-back" to="/">Back to app</Link>
      </div>
    </main>
  )
}

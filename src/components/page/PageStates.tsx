import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeftIcon } from '../icons'
import './page.css'

/** Back navigation link with an arrow icon. Drop-in for `<Link className="page-back">`. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="page-back" to={to}>
      <ArrowLeftIcon />
      {children}
    </Link>
  )
}

/** Reserved-height loading placeholder for a dataset. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/** Skeleton placeholder shown while a dataset is loading. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-list" role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton-block" aria-hidden="true" />
      ))}
    </div>
  )
}

type NoticeProps = {
  tone?: 'info' | 'error' | 'success'
  children: ReactNode
  /** Optional inline action, such as "Try again". */
  action?: { label: string; onClick: () => void }
}

/** Inline feedback. Errors are announced as alerts, everything else politely. */
export function Notice({ tone = 'info', children, action }: NoticeProps) {
  return (
    <p className="notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
      {action ? (
        <button type="button" className="notice__action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </p>
  )
}

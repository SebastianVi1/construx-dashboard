import type { ReactNode } from 'react'
import './page.css'

/** Reserved-height loading placeholder for a dataset. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
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

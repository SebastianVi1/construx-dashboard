import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  title: string
  body: string
  confirmLabel: string
  pendingLabel: string
  cancelLabel: string
  /** Server error to show above the buttons, from the caller's last attempt. */
  error: string | null
  /** Resolves when done; the caller closes the dialog and sets `error` on failure. */
  onConfirm: () => Promise<void>
  onClose: () => void
  /** `danger` (default) for destructive actions, `primary` to confirm a save. */
  confirmTone?: 'danger' | 'primary'
  /** Keeps the confirm button off until the caller's own check passes, such as typing a name. */
  confirmDisabled?: boolean
  /** Extra detail shown under the body, such as the changes being saved. */
  children?: ReactNode
}

/** Consequential confirmation (delete, archive, save) with a busy state that blocks double submits. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  error,
  onConfirm,
  onClose,
  confirmTone = 'danger',
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy || confirmDisabled) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} description={body} onClose={onClose}>
      {children}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className={`button button--${confirmTone}`} onClick={() => void confirm()} disabled={busy || confirmDisabled}>
          {busy ? pendingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

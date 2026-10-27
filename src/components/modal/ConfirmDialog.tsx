import { useState } from 'react'
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
}

/** Consequential confirmation (delete, archive) with a busy state that blocks double submits. */
export function ConfirmDialog({ title, body, confirmLabel, pendingLabel, cancelLabel, error, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} description={body} onClose={onClose}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="button button--danger" onClick={() => void confirm()} disabled={busy}>
          {busy ? pendingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

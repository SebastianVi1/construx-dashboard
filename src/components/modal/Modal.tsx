import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './modal.css'

type ModalProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

/**
 * Generic, accessible dialog. Owns the scrim, Escape-to-close, click-outside,
 * and ARIA wiring; callers supply the title and body. Nothing here is app or
 * feature specific.
 */
export function Modal({ title, description, children, onClose }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Always calls the latest onClose without re-running the effect: a new onClose on every render
  // (an inline arrow in the caller) must not move focus back to the dialog while the user types.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  })

  // Focus the dialog once, when it opens.
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

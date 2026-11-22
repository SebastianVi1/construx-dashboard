import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './modal.css'

type ModalProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  /**
   * `drawer` slides in from the right edge at full height, for reading a record beside its list.
   * `dock` sits in the bottom-right corner over a light scrim, for a panel opened from a floating button;
   * on phones it becomes a bottom sheet.
   */
  variant?: 'dialog' | 'drawer' | 'dock'
  /** Accessible name of a close button in the header; without it the header has none. */
  closeLabel?: string
}

/**
 * Generic, accessible dialog. Owns the scrim, Escape-to-close, click-outside,
 * and ARIA wiring; callers supply the title and body. Nothing here is app or
 * feature specific.
 */
export function Modal({ title, description, children, onClose, variant = 'dialog', closeLabel }: ModalProps) {
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
    <div className={`modal-overlay modal-overlay--${variant}`} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`modal modal--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div className="modal__heading">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {closeLabel ? (
            <button type="button" className="modal__close" aria-label={closeLabel} onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

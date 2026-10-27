import { useEffect, useId, useRef, useState } from 'react'

/**
 * Disclosure popover anchored to a trigger button: Escape closes it and
 * returns focus to the trigger; a pointer press outside, or focus leaving
 * both, closes it quietly. Opening moves focus to the first control inside.
 */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const inside = (target: EventTarget | null) =>
      target instanceof Node && Boolean(panel?.contains(target) || triggerRef.current?.contains(target))

    panel?.querySelector<HTMLElement>('a[href], button:not(:disabled)')?.focus()

    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget && !inside(event.relatedTarget)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    panel?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      panel?.removeEventListener('focusout', onFocusOut)
    }
  }, [open])

  return {
    open,
    triggerRef,
    panelRef,
    panelId,
    toggle: () => setOpen((value) => !value),
    /** Close; `restoreFocus` sends focus back to the trigger (skip it when navigating away). */
    close: (restoreFocus = true) => {
      setOpen(false)
      if (restoreFocus) triggerRef.current?.focus()
    },
  }
}

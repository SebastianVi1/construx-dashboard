import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { placeBubble, type BubblePlacement } from './placeBubble'
import './bubble.css'

type BubbleProps = {
  /**
   * Finds the element the bubble points at. Called on every frame, so the bubble follows an
   * anchor that moves (a map being panned or zoomed) or is re-rendered; null closes the bubble.
   */
  getAnchor: () => Element | null
  label: string
  children: ReactNode
  onClose: () => void
}

/**
 * Speech-bubble popup pointing at an element, rendered in a portal on `document.body` so no
 * ancestor's overflow or stacking context clips it. Escape and a press outside close it; a
 * press on the anchor itself is left to the anchor's own handler.
 */
export function Bubble({ getAnchor, label, children, onClose }: BubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<BubblePlacement | null>(null)

  const update = useEffectEvent(() => {
    const anchor = getAnchor()
    const bubble = bubbleRef.current
    if (!anchor) {
      onClose()
      return
    }
    if (!bubble) return
    const next = placeBubble(
      anchor.getBoundingClientRect(),
      { width: bubble.offsetWidth, height: bubble.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setPlacement((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.side === next.side &&
      prev.arrowLeft === next.arrowLeft
        ? prev
        : next,
    )
  })

  // Measure before the first paint so the bubble never flashes in the corner
  useLayoutEffect(() => {
    update()
  }, [children])

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      update()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const handlePointerDown = useEffectEvent((event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (bubbleRef.current?.contains(target) || getAnchor()?.contains(target)) return
    onClose()
  })
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  })

  useEffect(() => {
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    bubbleRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return createPortal(
    <div
      ref={bubbleRef}
      className="bubble"
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      data-side={placement?.side ?? 'top'}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        visibility: placement ? 'visible' : 'hidden',
        ['--bubble-arrow-left' as string]: `${placement?.arrowLeft ?? 0}px`,
      }}
    >
      <div className="bubble__scroll">{children}</div>
    </div>,
    document.body,
  )
}

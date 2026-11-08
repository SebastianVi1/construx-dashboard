export type Rect = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }

export type BubblePlacement = {
  top: number
  left: number
  /** Which side of the anchor the bubble sits on; the arrow points the other way. */
  side: 'top' | 'bottom'
  /** Arrow centre, in px from the bubble's left edge. */
  arrowLeft: number
}

/** Smallest distance kept between the arrow and the bubble's rounded corners. */
const ARROW_INSET = 14

/**
 * Where a bubble goes next to its anchor, in viewport coordinates: above it when it fits,
 * otherwise below, otherwise on the roomier side; centred on the anchor but kept inside the
 * viewport, with the arrow still pointing at the anchor.
 */
export function placeBubble(anchor: Rect, bubble: Size, viewport: Size, gap = 10, gutter = 16): BubblePlacement {
  const above = anchor.top - gap - gutter
  const below = viewport.height - (anchor.top + anchor.height) - gap - gutter
  const side = bubble.height <= above || (bubble.height > below && above >= below) ? 'top' : 'bottom'
  const top = side === 'top' ? anchor.top - gap - bubble.height : anchor.top + anchor.height + gap

  const centre = anchor.left + anchor.width / 2
  const maxLeft = viewport.width - gutter - bubble.width
  const left = Math.max(gutter, Math.min(centre - bubble.width / 2, maxLeft))
  const arrowLeft = Math.max(ARROW_INSET, Math.min(centre - left, bubble.width - ARROW_INSET))

  return { top, left, side, arrowLeft }
}

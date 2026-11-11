/** A rectangle in screen pixels (y grows downwards). */
export type Box = { minX: number; minY: number; maxX: number; maxY: number }

export type OccupantSide = 'above' | 'right' | 'left' | 'below'

/** Figures per row before the strip wraps; matches the strip's max width in floor-plans.css. */
const PER_ROW = 5
const FIGURE = 20
const FIGURE_GAP = 2
const PADDING = 3

/** Space the strip of a zone's figures takes on screen, for `count` figures (the "+N" chip counts as one). */
export function occupantStripSize(count: number): { width: number; height: number } {
  const columns = Math.min(Math.max(count, 1), PER_ROW)
  const rows = Math.ceil(Math.max(count, 1) / PER_ROW)
  return {
    width: 2 * PADDING + columns * FIGURE + (columns - 1) * FIGURE_GAP,
    height: 2 * PADDING + rows * FIGURE + (rows - 1) * FIGURE_GAP,
  }
}

function overlap(a: Box, b: Box): number {
  const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return width > 0 && height > 0 ? width * height : 0
}

/**
 * Where the figures of a zone stand: outside it, so they never cover what is pinned inside. Above the
 * zone first, then right, left and below, taking the first side where the strip covers no obstacle
 * (another zone, a pin); with every side taken, the one that covers the least. Returns the strip's centre.
 */
export function placeOccupants(
  zone: Box,
  size: { width: number; height: number },
  obstacles: Box[],
  gap = 6,
): { side: OccupantSide; x: number; y: number } {
  const centreX = (zone.minX + zone.maxX) / 2
  const centreY = (zone.minY + zone.maxY) / 2
  const candidates: Array<{ side: OccupantSide; x: number; y: number }> = [
    { side: 'above', x: centreX, y: zone.minY - gap - size.height / 2 },
    { side: 'right', x: zone.maxX + gap + size.width / 2, y: centreY },
    { side: 'left', x: zone.minX - gap - size.width / 2, y: centreY },
    { side: 'below', x: centreX, y: zone.maxY + gap + size.height / 2 },
  ]
  let best = candidates[0]!
  let bestCovered = Infinity
  for (const candidate of candidates) {
    const strip: Box = {
      minX: candidate.x - size.width / 2,
      minY: candidate.y - size.height / 2,
      maxX: candidate.x + size.width / 2,
      maxY: candidate.y + size.height / 2,
    }
    const covered = obstacles.reduce((sum, obstacle) => sum + overlap(strip, obstacle), 0)
    if (covered < bestCovered) {
      best = candidate
      bestCovered = covered
    }
  }
  return best
}

/**
 * How many rows fill the area below a page header on this viewport. A placeholder should look
 * like a full screen of data, whether the answer has ten rows or none.
 */
export function skeletonRowCount({ rowHeight = 52, reserved = 340, min = 6, max = 14 } = {}): number {
  if (typeof window === 'undefined' || !window.innerHeight) return 8
  return Math.min(max, Math.max(min, Math.round((window.innerHeight - reserved) / rowHeight)))
}

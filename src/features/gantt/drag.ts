import { DAY_MS, dayScale, type Dated, type Zoom } from './timeline'

/**
 * Drag rules for Gantt bars, in whole days. Every function returns the day
 * offset that will actually be applied, clamped like the server rules: a task
 * stays inside its phase, a phase never cuts through its tasks.
 */

export type Edge = 'start' | 'end'

/** A pointer distance snapped to whole days (never `-0`). */
export function pxToDays(px: number, zoom: Zoom): number {
  return Math.round(px / dayScale[zoom]) || 0
}

/** The same instant moved by whole days, as the backend shift does. */
export function shiftInstant(instant: string, days: number): string {
  return new Date(Date.parse(instant) + days * DAY_MS).toISOString()
}

/** Fewest days that move `from` to at least `to`. */
const atLeast = (from: string, to: string) => Math.ceil((Date.parse(to) - Date.parse(from)) / DAY_MS) || 0
/** Most days that keep `from` at most `to`. */
const atMost = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS) || 0

function clamp(days: number, min: number, max: number): number {
  if (min > max) return 0
  return Math.min(max, Math.max(min, days))
}

/** Moving the whole task keeps it inside the phase. */
export function clampTaskMove(task: Dated, phase: Dated, days: number): number {
  return clamp(days, atLeast(task.startAt, phase.startAt), atMost(task.dueAt, phase.dueAt))
}

/** Moving one edge keeps start <= due and both inside the phase. */
export function clampTaskResize(task: Dated, phase: Dated, edge: Edge, days: number): number {
  return edge === 'start'
    ? clamp(days, atLeast(task.startAt, phase.startAt), atMost(task.startAt, task.dueAt))
    : clamp(days, atLeast(task.dueAt, task.startAt), atMost(task.dueAt, phase.dueAt))
}

/** Moving one phase edge stops at its tasks, or at its other edge when it has none. */
export function clampPhaseResize(phase: Dated, tasks: Dated[], edge: Edge, days: number): number {
  if (edge === 'start') {
    const limit = tasks.reduce(
      (earliest, task) => (Date.parse(task.startAt) < Date.parse(earliest) ? task.startAt : earliest),
      phase.dueAt,
    )
    return Math.min(days, atMost(phase.startAt, limit))
  }
  const limit = tasks.reduce(
    (latest, task) => (Date.parse(task.dueAt) > Date.parse(latest) ? task.dueAt : latest),
    phase.startAt,
  )
  return Math.max(days, atLeast(phase.dueAt, limit))
}

/** A phase body drag as the `days` for `POST .../shift`; null when it snaps back to zero. */
export function phaseMove(px: number, zoom: Zoom): number | null {
  const days = pxToDays(px, zoom)
  return days === 0 ? null : days
}

/**
 * Tells a bar's click apart from the click a browser fires right after a mouse
 * drag. Touch drags fire no click, so every new press clears the mark, and a
 * keyboard click (`detail` 0) is never swallowed.
 */
export function createClickGuard() {
  let afterDrag = false
  return {
    press() {
      afterDrag = false
    },
    dragged() {
      afterDrag = true
    },
    /** True only for the click that ends a drag. */
    swallow(detail: number): boolean {
      const swallowed = afterDrag && detail > 0
      afterDrag = false
      return swallowed
    },
  }
}

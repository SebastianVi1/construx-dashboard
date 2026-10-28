/**
 * Pure timeline math for the Gantt: which days the chart shows and where a bar
 * sits. Every bar covers whole local days, from its start day through its due
 * day, so a task due the day it starts is one day wide.
 */

export const DAY_MS = 86_400_000

export const zooms = ['day', 'week', 'month'] as const

export type Zoom = (typeof zooms)[number]

/** Pixels per day at each zoom. */
export const dayScale: Record<Zoom, number> = { day: 40, week: 16, month: 5 }

/** Local midnights in milliseconds; `end` is exclusive. */
export type Range = { start: number; end: number }

export type Dated = { startAt: string; dueAt: string }

/** The site's planned dates (`YYYY-MM-DD`), either of which may be missing. */
export type SiteDates = { startDate: string | null; expectedEndDate: string | null }

const PADDING_DAYS = 7
const EMPTY_AHEAD_DAYS = 30

function startOfDay(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function addDays(ms: number, days: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime()
}

/** Whole days between two local midnights; rounding absorbs daylight-saving hours. */
function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS)
}

/** A `YYYY-MM-DD` site date as its local midnight. */
export function dateOnly(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

/** Days shown: every phase, the site window and today, padded by a week on each side. */
export function buildRange(phases: Dated[], site: SiteDates, today: Date): Range {
  const starts = phases.map((phase) => startOfDay(Date.parse(phase.startAt)))
  const ends = phases.map((phase) => addDays(startOfDay(Date.parse(phase.dueAt)), 1))
  if (site.startDate) starts.push(dateOnly(site.startDate))
  if (site.expectedEndDate) ends.push(addDays(dateOnly(site.expectedEndDate), 1))
  const now = startOfDay(today.getTime())
  const empty = starts.length === 0 && ends.length === 0
  const start = Math.min(now, ...starts)
  const end = Math.max(addDays(now, 1 + (empty ? EMPTY_AHEAD_DAYS - PADDING_DAYS : 0)), ...ends)
  return { start: addDays(start, -PADDING_DAYS), end: addDays(end, PADDING_DAYS) }
}

export function chartWidth(range: Range, zoom: Zoom): number {
  return daysBetween(range.start, range.end) * dayScale[zoom]
}

/** Horizontal position of any instant. */
export function xOf(ms: number, range: Range, zoom: Zoom): number {
  return ((ms - range.start) / DAY_MS) * dayScale[zoom]
}

export type Position = { left: number; width: number }

/** A bar from the start day through the due day. */
export function barPosition(startAt: string, dueAt: string, range: Range, zoom: Zoom): Position {
  const first = startOfDay(Date.parse(startAt))
  const last = startOfDay(Date.parse(dueAt))
  const scale = dayScale[zoom]
  return {
    left: daysBetween(range.start, first) * scale,
    width: Math.max(1, daysBetween(first, last) + 1) * scale,
  }
}

export type Tick = { left: number; label: string }

/** Grid labels: every day, every Monday, or every first of the month. */
export function ticks(range: Range, zoom: Zoom, intlLocale: string): Tick[] {
  const monthDay = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' })
  const monthYear = new Intl.DateTimeFormat(intlLocale, { month: 'short', year: 'numeric' })
  const result: Tick[] = []
  for (let ms = range.start; ms < range.end; ms = addDays(ms, 1)) {
    const date = new Date(ms)
    const left = daysBetween(range.start, ms) * dayScale[zoom]
    if (zoom === 'day') {
      const named = ms === range.start || date.getDate() === 1
      result.push({ left, label: named ? monthDay.format(date) : String(date.getDate()) })
    } else if (zoom === 'week' && date.getDay() === 1) {
      result.push({ left, label: monthDay.format(date) })
    } else if (zoom === 'month' && date.getDate() === 1) {
      result.push({ left, label: monthYear.format(date) })
    }
  }
  return result
}

/** The shaded site window; a missing date runs to the edge of the chart. */
export function siteWindow(site: SiteDates, range: Range, zoom: Zoom): Position | null {
  if (!site.startDate && !site.expectedEndDate) return null
  const start = site.startDate ? dateOnly(site.startDate) : range.start
  const end = site.expectedEndDate ? addDays(dateOnly(site.expectedEndDate), 1) : range.end
  const scale = dayScale[zoom]
  return { left: daysBetween(range.start, start) * scale, width: Math.max(0, daysBetween(start, end)) * scale }
}

/** The phase is due after the site's expected end day. */
export function endsAfterSite(phase: Pick<Dated, 'dueAt'>, site: SiteDates): boolean {
  if (!site.expectedEndDate) return false
  return Date.parse(phase.dueAt) >= addDays(dateOnly(site.expectedEndDate), 1)
}

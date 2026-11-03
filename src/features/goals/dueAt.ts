const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Value of a `date` input (YYYY-MM-DD in the browser's zone) as an ISO-8601
 * instant at midnight of that local date, or null when empty or malformed.
 */
export function localInputToInstant(value: string): string | null {
  const match = LOCAL_INPUT.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** An API instant as a `date` input value (YYYY-MM-DD) in the browser's zone. */
export function instantToLocalInput(instant: string): string {
  const date = new Date(instant)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Dec 15, 2026" in the given Intl locale; the zone defaults to the browser's. */
export function dueText(instant: string, intlLocale: string, timeZone?: string): string {
  return new Date(instant).toLocaleDateString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone,
  })
}

export function isOverdue(instant: string, now: Date): boolean {
  return new Date(instant).getTime() < now.getTime()
}

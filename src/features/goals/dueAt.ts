const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Value of a `datetime-local` input (wall-clock time in the browser's zone)
 * as an ISO-8601 instant for the API, or null when it is empty or malformed.
 */
export function localInputToInstant(value: string): string | null {
  const match = LOCAL_INPUT.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** An API instant as a `datetime-local` input value in the browser's zone. */
export function instantToLocalInput(instant: string): string {
  const date = new Date(instant)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "Dec 15, 2026, 11:59 PM" in the given Intl locale; the zone defaults to the browser's. */
export function dueText(instant: string, intlLocale: string, timeZone?: string): string {
  return new Date(instant).toLocaleString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

export function isOverdue(instant: string, now: Date): boolean {
  return new Date(instant).getTime() < now.getTime()
}

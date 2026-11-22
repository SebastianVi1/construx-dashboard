/** Today's date in the user's time zone as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Days in a month (`month` 1..12); calendar arithmetic only, no time zone involved. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * `isoDate` (YYYY-MM-DD) plus `months` calendar months; a day past the target
 * month's end clamps to its last day (Jan 31 + 1 is Feb 28 or 29). Works on the
 * Y-M-D parts, so neither the time zone nor DST can shift the day. Throws
 * RangeError on a malformed date.
 */
export function addMonths(isoDate: string, months: number): string {
  const match = ISO_DATE.exec(isoDate)
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  const day = Number(match?.[3])
  if (!match || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) || !Number.isInteger(months)) {
    throw new RangeError(`Invalid date: ${isoDate}`)
  }
  const index = year * 12 + (month - 1) + months
  const targetYear = Math.floor(index / 12)
  const targetMonth = index - targetYear * 12 + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

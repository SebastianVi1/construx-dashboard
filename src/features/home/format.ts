export type CurrencyCode = 'USD' | 'EUR' | 'ARS'

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formats an ISO date (yyyy-mm-dd) as a short date, independent of the
 * machine's timezone so tests and renders are deterministic.
 */
export function formatDate(isoDate: string, locale = 'en-US'): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString(locale, DATE_OPTIONS)
}

/**
 * Formats an ISO month (yyyy-mm) as a long month and year, independent of the
 * machine's timezone so tests and renders are deterministic.
 */
export function formatMonthYear(isoMonth: string, locale = 'en-US'): string {
  const [year, month] = isoMonth.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' })
}

export type Variance =
  | { status: 'savings'; amount: number }
  | { status: 'overrun'; amount: number }
  | { status: 'no-data' }

/**
 * Planned budget minus recorded cost. Negative differences are overruns, and
 * missing budget or cost data is reported as `no-data` rather than zero.
 */
export function budgetVariance(budget: number | null, cost: number | null): Variance {
  if (budget === null || cost === null) return { status: 'no-data' }
  const difference = budget - cost
  if (difference < 0) return { status: 'overrun', amount: Math.abs(difference) }
  return { status: 'savings', amount: difference }
}

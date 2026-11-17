import { intlLocales, type Locale } from '../../i18n/locale'
import { DETAIL_HISTORY_LIMIT } from './pricesApi'

const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

/** An instant (ISO-8601) as its date in the user's time zone: "Nov 15, 2026" / "15 nov 2026". */
export function formatInstant(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocales[locale], dateOptions).format(new Date(iso))
}

/** A calendar date (`YYYY-MM-DD`) as that same day, whatever the user's time zone. */
export function formatDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { ...dateOptions, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

/** The detail sends at most 100 entries; at the limit there may be older ones. */
export function hasMoreHistory(shown: number): boolean {
  return shown >= DETAIL_HISTORY_LIMIT
}

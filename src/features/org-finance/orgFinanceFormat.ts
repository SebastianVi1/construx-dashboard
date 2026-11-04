import { formatMessage, intlLocales, type Locale, type Messages } from '../../i18n'

/** "64%" or "95.5%": at most one decimal. */
export function percentText(value: number, locale: Locale, messages: Messages): string {
  const number = new Intl.NumberFormat(intlLocales[locale], { maximumFractionDigits: 1 }).format(value)
  return formatMessage(messages.orgFinance.percent, { percent: number })
}

function monthDate(month: string): Date {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index - 1, 1)
}

/** Axis label for a `YYYY-MM` month: "Jan". */
export function monthShortText(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { month: 'short' }).format(monthDate(month))
}

/** Full label for a `YYYY-MM` month: "January 2026". */
export function monthLongText(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { month: 'long', year: 'numeric' }).format(monthDate(month))
}

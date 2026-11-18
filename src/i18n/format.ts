import { intlLocales, type Locale } from './locale'

/**
 * Minimal placeholder interpolation: `formatMessage('Hi {name}', { name: 'Ada' })`
 * → `'Hi Ada'`. Unknown placeholders are left untouched so a typo in a key is
 * visible instead of silently vanishing.
 */
export function formatMessage(message: string, params: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

const dateTimeFormats = new Map<Locale, Intl.DateTimeFormat>()

/** A date with a medium date and a short time in the app locale, e.g. "Mar 10, 2026, 9:30 AM". */
export function formatDateTime(value: string | number | Date, locale: Locale): string {
  let format = dateTimeFormats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })
    dateTimeFormats.set(locale, format)
  }
  return format.format(value instanceof Date ? value : new Date(value))
}

import { describe, expect, it } from 'bun:test'
import { formatDateTime } from '../../i18n/format'
import { intlLocales } from '../../i18n/locale'

describe('formatDateTime', () => {
  const instant = '2026-03-10T15:30:00Z'

  it('formats an instant with a medium date and a short time in the app locale', () => {
    for (const locale of ['en', 'es'] as const) {
      const expected = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })
        .format(new Date(instant))
      expect(formatDateTime(instant, locale)).toBe(expected)
    }
  })

  it('accepts a Date or epoch milliseconds as well as an ISO string', () => {
    const ms = Date.parse(instant)
    expect(formatDateTime(new Date(ms), 'en')).toBe(formatDateTime(instant, 'en'))
    expect(formatDateTime(ms, 'es')).toBe(formatDateTime(instant, 'es'))
  })
})

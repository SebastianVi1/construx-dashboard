import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { localToday } from '../../lib/dates'

const originalTimeZone = process.env.TZ

afterEach(() => {
  setSystemTime()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe('localToday', () => {
  it('pads single-digit months and days', () => {
    expect(localToday(new Date(2026, 0, 9, 12))).toBe('2026-01-09')
    expect(localToday(new Date(2026, 10, 16, 12))).toBe('2026-11-16')
  })

  it('uses the local calendar day when UTC has already crossed midnight', () => {
    process.env.TZ = 'America/Mexico_City'
    expect(localToday(new Date('2026-01-01T03:04:00Z'))).toBe('2025-12-31')
  })

  it('uses the local calendar day when it is ahead of UTC', () => {
    process.env.TZ = 'Asia/Tokyo'
    expect(localToday(new Date('2026-12-31T18:00:00Z'))).toBe('2027-01-01')
  })

  it('defaults to the current clock in the local time zone', () => {
    process.env.TZ = 'America/Mexico_City'
    setSystemTime(new Date('2026-02-01T02:00:00Z'))
    expect(localToday()).toBe('2026-01-31')
  })
})

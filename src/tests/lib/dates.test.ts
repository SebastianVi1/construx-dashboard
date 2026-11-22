import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { addMonths, localToday } from '../../lib/dates'

const originalTimeZone = process.env.TZ

afterEach(() => {
  setSystemTime()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe('addMonths', () => {
  it.each([
    ['2026-01-31', 3, '2026-04-30'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2027-11-30', 3, '2028-02-29'],
    ['2026-12-31', 3, '2027-03-31'],
    ['2026-11-22', 3, '2027-02-22'],
    ['2026-11-22', 0, '2026-11-22'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2028-02-29', 12, '2029-02-28'],
  ])('%s plus %i calendar months is %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected)
  })

  it.each(['2026-13-01', '2026-1-5', ''])('rejects malformed date %s', (date) => {
    expect(() => addMonths(date, 3)).toThrow(RangeError)
  })
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

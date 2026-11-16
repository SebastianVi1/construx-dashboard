import { describe, expect, it } from 'bun:test'
import { localToday } from '../../lib/localDate'

describe('localToday', () => {
  it('is the local calendar date, not UTC', () => {
    expect(localToday(new Date(2026, 9, 27, 23, 30))).toBe('2026-10-27')
    expect(localToday(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
})

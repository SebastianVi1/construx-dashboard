import { describe, expect, it } from 'bun:test'
import { formatDay, formatInstant, hasMoreHistory } from '../../../features/prices/resourceDisplay'

describe('resource display', () => {
  it('shows a calendar date as that same day in both languages', () => {
    expect(formatDay('2026-11-01', 'en')).toBe('Nov 1, 2026')
    expect(formatDay('2026-11-01', 'es')).toBe('1 nov 2026')
  })

  it('shows an instant as its date', () => {
    expect(formatInstant('2026-11-15T12:00:00Z', 'en')).toBe('Nov 15, 2026')
  })

  it('offers the full history only when the detail hit its 100-entry limit', () => {
    expect(hasMoreHistory(100)).toBe(true)
    expect(hasMoreHistory(99)).toBe(false)
    expect(hasMoreHistory(0)).toBe(false)
  })
})

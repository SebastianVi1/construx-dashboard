import { describe, expect, it } from 'bun:test'
import { dueText, instantToLocalInput, isOverdue, localInputToInstant } from '../../../features/goals/dueAt'

describe('due date', () => {
  it('turns a local date input into the instant at midnight of that day', () => {
    expect(localInputToInstant('2026-12-15')).toBe(new Date(2026, 11, 15).toISOString())
  })

  it('rejects an empty or malformed input', () => {
    expect(localInputToInstant('')).toBeNull()
    expect(localInputToInstant('tomorrow')).toBeNull()
    expect(localInputToInstant('2026-12-15T18:30')).toBeNull()
  })

  it('shows an instant as a local date input value and round-trips it', () => {
    const instant = new Date(2027, 0, 5).toISOString()
    expect(instantToLocalInput(instant)).toBe('2027-01-05')
    expect(localInputToInstant(instantToLocalInput(instant))).toBe(new Date(2027, 0, 5).toISOString())
  })

  it('formats a due instant with date only in the given locale and zone', () => {
    const text = dueText('2026-12-15T23:59:00Z', 'en-US', 'UTC')
    expect(text).toContain('Dec 15, 2026')
    expect(text).not.toMatch(/\d+:\d+/)
    expect(dueText('2026-12-15T23:59:00Z', 'es', 'UTC')).toContain('15 dic 2026')
  })

  it('is overdue only when the due instant has passed', () => {
    const now = new Date('2026-12-16T00:00:00Z')
    expect(isOverdue('2026-12-15T23:59:00Z', now)).toBe(true)
    expect(isOverdue('2026-12-16T00:01:00Z', now)).toBe(false)
  })
})

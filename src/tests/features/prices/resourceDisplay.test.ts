import { describe, expect, it } from 'bun:test'
import { formatDay, formatInstant, hasMoreHistory, moneyText } from '../../../features/prices/resourceDisplay'

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

describe('moneyText', () => {
  const money = (amountMxn: number | string) => `MXN ${typeof amountMxn}:${amountMxn}`

  it('passes an API amount to the display formatter as a number', () => {
    expect(moneyText(money, '290.00')).toBe('MXN number:290')
    expect(moneyText(money, '0.00')).toBe('MXN number:0')
  })

  it('gives null for a missing amount, so the caller shows its own "no cost"', () => {
    expect(moneyText(money, null)).toBeNull()
  })
})

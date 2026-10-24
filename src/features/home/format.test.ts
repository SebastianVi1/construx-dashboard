import { describe, expect, it } from 'bun:test'
import { budgetVariance, formatCurrency, formatDate, formatMonthYear } from './format'

describe('formatCurrency', () => {
  it('formats whole amounts in USD', () => {
    expect(formatCurrency(1_400_000, 'USD')).toBe('$1,400,000')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-200, 'USD')).toBe('-$200')
  })
})

describe('formatDate', () => {
  it('formats an ISO date as a short US date regardless of timezone', () => {
    expect(formatDate('2026-10-19')).toBe('Oct 19, 2026')
  })
})

describe('formatMonthYear', () => {
  it('formats an ISO month as a long month and year per locale', () => {
    expect(formatMonthYear('2026-10')).toBe('October 2026')
    expect(formatMonthYear('2026-10', 'es')).toBe('octubre de 2026')
  })
})

describe('budgetVariance', () => {
  it('reports savings when cost is below budget', () => {
    expect(budgetVariance(1_000, 500)).toEqual({ status: 'savings', amount: 500 })
  })

  it('reports overrun when cost exceeds budget', () => {
    expect(budgetVariance(1_000, 1_200)).toEqual({ status: 'overrun', amount: 200 })
  })

  it('reports no-data when budget or cost is missing', () => {
    expect(budgetVariance(null, 500)).toEqual({ status: 'no-data' })
    expect(budgetVariance(1_000, null)).toEqual({ status: 'no-data' })
    expect(budgetVariance(null, null)).toEqual({ status: 'no-data' })
  })
})

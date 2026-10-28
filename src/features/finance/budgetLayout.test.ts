import { describe, expect, it } from 'bun:test'
import { budgetChart } from './budgetLayout'
import type { BudgetSummary } from './financeApi'

function summary(allocatedBudget: number | null, amounts: [number, number, number, number]): BudgetSummary {
  const spent = amounts.reduce((sum, amount) => sum + amount, 0)
  return {
    allocatedBudget,
    spent,
    remaining: allocatedBudget === null ? null : allocatedBudget - spent,
    allocatedToPhases: 0,
    unallocated: allocatedBudget,
    byCategory: (['MATERIALS', 'LABOR', 'EQUIPMENT', 'OTHER'] as const).map((category, index) => ({
      category,
      amount: amounts[index],
    })),
  }
}

describe('budget chart', () => {
  it('splits the bar into spend per category plus what remains, skipping empty categories', () => {
    const chart = budgetChart(summary(10000, [3000, 1000, 0, 0]))
    expect(chart.status).toBe('within')
    expect(chart.segments).toEqual([
      { category: 'MATERIALS', amount: 3000, share: 0.3 },
      { category: 'LABOR', amount: 1000, share: 0.1 },
    ])
    expect(chart.remainingShare).toBeCloseTo(0.6)
    expect(chart.budgetMarker).toBeNull()
    expect(chart.usedOfBudget).toBeCloseTo(0.4)
  })

  it('on an overrun scales the bar to the spend and marks where the budget ends', () => {
    const chart = budgetChart(summary(100, [150, 50, 0, 0]))
    expect(chart.status).toBe('overrun')
    expect(chart.segments.map((s) => s.share)).toEqual([0.75, 0.25])
    expect(chart.remainingShare).toBe(0)
    expect(chart.budgetMarker).toBe(0.5)
    expect(chart.usedOfBudget).toBe(2)
  })

  it('spending exactly the budget is not an overrun', () => {
    const chart = budgetChart(summary(100, [100, 0, 0, 0]))
    expect(chart.status).toBe('within')
    expect(chart.remainingShare).toBe(0)
  })

  it('without a budget the bar only shows the spend mix', () => {
    const chart = budgetChart(summary(null, [20, 0, 0, 80]))
    expect(chart.status).toBe('noBudget')
    expect(chart.segments.map((s) => s.share)).toEqual([0.2, 0.8])
    expect(chart.remainingShare).toBe(0)
    expect(chart.usedOfBudget).toBeNull()
  })

  it('a budget with no expenses is all remaining, and nothing at all is empty', () => {
    expect(budgetChart(summary(500, [0, 0, 0, 0]))).toMatchObject({ segments: [], remainingShare: 1, usedOfBudget: 0 })
    expect(budgetChart(summary(null, [0, 0, 0, 0]))).toMatchObject({ segments: [], remainingShare: 0, status: 'noBudget' })
    expect(budgetChart(summary(0, [0, 0, 0, 0]))).toMatchObject({ segments: [], remainingShare: 0, usedOfBudget: null })
  })
})

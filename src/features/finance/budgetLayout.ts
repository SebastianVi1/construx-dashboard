import type { BudgetSummary, ExpenseCategory } from './financeApi'

export type BudgetStatus = 'noBudget' | 'within' | 'overrun'

export type BudgetSegment = { category: ExpenseCategory; amount: number; share: number }

export type BudgetChart = {
  status: BudgetStatus
  /** Spend per category with a share of the bar width (0..1); empty categories are left out. */
  segments: BudgetSegment[]
  /** Width left for the unspent budget. */
  remainingShare: number
  /** On an overrun the bar is scaled to the spend; this is where the budget ends (0..1). */
  budgetMarker: number | null
  /** Spent divided by the budget (1.2 = 120%); null without a positive budget. */
  usedOfBudget: number | null
}

/**
 * Lays out the quick budget chart: one bar as wide as the larger of budget and spend,
 * split into the spend per category and, while within budget, the remaining amount.
 */
export function budgetChart(summary: BudgetSummary): BudgetChart {
  const budget = summary.allocatedBudget
  const spent = summary.spent
  const status: BudgetStatus = budget === null ? 'noBudget' : spent > budget ? 'overrun' : 'within'
  const scale = Math.max(budget ?? 0, spent)
  const segments =
    scale > 0
      ? summary.byCategory
          .filter((entry) => entry.amount > 0)
          .map((entry) => ({ category: entry.category, amount: entry.amount, share: entry.amount / scale }))
      : []
  return {
    status,
    segments,
    remainingShare: budget !== null && scale > 0 ? Math.max(budget - spent, 0) / scale : 0,
    budgetMarker: status === 'overrun' && budget !== null ? budget / scale : null,
    usedOfBudget: budget !== null && budget > 0 ? spent / budget : null,
  }
}

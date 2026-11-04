import { expenseCategories, type ExpenseCategory } from '../finance/financeApi'
import type { FinancePeriod, MonthlyExpenses } from './orgFinanceApi'

export const financeRanges = ['3M', '6M', '1Y'] as const

export type FinanceRange = (typeof financeRanges)[number]

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Period behind each selector, ending today: 3M and 6M start on the first day of the month
 * 2 and 5 months back (the current month counts), 1Y is the year in progress.
 */
export function financePeriod(range: FinanceRange, today: Date): FinancePeriod {
  const start =
    range === '1Y'
      ? new Date(today.getFullYear(), 0, 1)
      : new Date(today.getFullYear(), today.getMonth() - (range === '3M' ? 2 : 5), 1)
  return { from: isoDate(start), to: isoDate(today) }
}

export type BurnPoint = {
  month: string
  spent: number
  /** Spend from the start of the period up to and including this month. */
  cumulative: number
  /** Bar height and running-total height as a share of the scale (0..1). */
  bar: number
  line: number
}

export type BurnChartLayout = {
  /** Top of the scale: the budget, or the running total when it went past it. */
  max: number
  /** Height of the budget ceiling as a share of the scale; null without a budget. */
  ceiling: number | null
  points: BurnPoint[]
  /** First month whose running total passed the budget, if any. */
  overBudgetFrom: string | null
}

/** Monthly spend and its running total against the company budget, all on one scale. */
export function burnChartLayout(months: MonthlyExpenses['months'], totalBudget: number): BurnChartLayout {
  let running = 0
  const totals = months.map((month) => (running += month.spent))
  const max = Math.max(totalBudget, running, ...months.map((month) => month.spent))
  const scale = (value: number) => (max > 0 ? value / max : 0)
  const overIndex = totalBudget > 0 ? totals.findIndex((total) => total > totalBudget) : -1
  return {
    max,
    ceiling: totalBudget > 0 ? scale(totalBudget) : null,
    points: months.map((month, index) => ({
      month: month.month,
      spent: month.spent,
      cumulative: totals[index],
      bar: scale(month.spent),
      line: scale(totals[index]),
    })),
    overBudgetFrom: overIndex >= 0 ? months[overIndex].month : null,
  }
}

export type DonutSlice = { category: ExpenseCategory; amount: number; share: number; offset: number }

/** Categories with spend, in the fixed category order, each with its share and where its arc starts. */
export function donutSlices(byCategory: { category: ExpenseCategory; amount: number }[]): DonutSlice[] {
  const amounts = new Map(byCategory.map((entry) => [entry.category, entry.amount]))
  const spent = expenseCategories.filter((category) => (amounts.get(category) ?? 0) > 0)
  const total = spent.reduce((sum, category) => sum + (amounts.get(category) ?? 0), 0)
  let offset = 0
  return spent.map((category) => {
    const amount = amounts.get(category) ?? 0
    const slice = { category, amount, share: amount / total, offset }
    offset += slice.share
    return slice
  })
}

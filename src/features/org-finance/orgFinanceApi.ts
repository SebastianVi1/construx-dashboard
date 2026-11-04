import { z } from 'zod'
import { getJson } from '../auth/authApi'
import { expenseCategories } from '../finance/financeApi'
import { organizationPath } from '../permissions/permissionsApi'

export const siteFinanceStatuses = ['OK', 'NEAR_LIMIT', 'OVER_BUDGET', 'NO_BUDGET'] as const

export type SiteFinanceStatus = (typeof siteFinanceStatuses)[number]

/** One site in the company roll-up. Budget, remaining and usage are null without a budget. */
export const siteFinanceSchema = z.object({
  siteId: z.string().min(1),
  siteName: z.string(),
  allocatedBudget: z.number().nullable().default(null),
  spent: z.number(),
  remaining: z.number().nullable().default(null),
  executionPct: z.number().nullable().default(null),
  status: z.enum(siteFinanceStatuses),
})

export type SiteFinance = z.infer<typeof siteFinanceSchema>

/**
 * `GET /organizations/{id}/finance/summary` (company-wide VIEW_BUDGET). Totals only count sites with a
 * budget; `totalRemaining` is negative on an overrun and `executionPct` is null when no site has a budget.
 */
export const orgFinanceSummarySchema = z.object({
  totalBudget: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  executionPct: z.number().nullable().default(null),
  sitesOverBudget: z.number().int().default(0),
  sitesNearLimit: z.number().int().default(0),
  byCategory: z.array(z.object({ category: z.enum(expenseCategories), amount: z.number() })).default([]),
  sites: z.array(siteFinanceSchema),
})

export type OrgFinanceSummary = z.infer<typeof orgFinanceSummarySchema>

/** `GET /organizations/{id}/finance/expenses/monthly`: spend per `YYYY-MM`, gaps filled with 0. */
export const monthlyExpensesSchema = z.object({
  totalBudget: z.number(),
  months: z.array(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), spent: z.number() })),
})

export type MonthlyExpenses = z.infer<typeof monthlyExpensesSchema>

/** Inclusive period as `YYYY-MM-DD` dates. */
export type FinancePeriod = { from: string; to: string }

function financePath(organizationId: string): string {
  return `${organizationPath(organizationId)}/finance`
}

export function getOrgFinanceSummary(organizationId: string): Promise<OrgFinanceSummary> {
  return getJson(`${financePath(organizationId)}/summary`, orgFinanceSummarySchema)
}

export function getMonthlyExpenses(organizationId: string, period: FinancePeriod): Promise<MonthlyExpenses> {
  const query = new URLSearchParams({ from: period.from, to: period.to })
  return getJson(`${financePath(organizationId)}/expenses/monthly?${query}`, monthlyExpensesSchema)
}

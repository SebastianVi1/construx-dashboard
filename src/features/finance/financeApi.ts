import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

/** Fixed order: the summary, the chart colors and the legend all follow it. */
export const expenseCategories = ['MATERIALS', 'LABOR', 'EQUIPMENT', 'OTHER'] as const

export type ExpenseCategory = (typeof expenseCategories)[number]

/** `ExpenseData`: money spent on a site, in MXN. */
export const expenseSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  amount: z.number(),
  spentOn: z.string(),
  description: z.string(),
  category: z.enum(expenseCategories),
})

export type Expense = z.infer<typeof expenseSchema>

/** `BudgetSummary`: `remaining` is null without a budget and negative on an overrun. */
export const budgetSummarySchema = z.object({
  allocatedBudget: z.number().nullable(),
  spent: z.number(),
  remaining: z.number().nullable(),
  byCategory: z.array(z.object({ category: z.enum(expenseCategories), amount: z.number() })),
})

export type BudgetSummary = z.infer<typeof budgetSummarySchema>

export type ExpenseDraft = {
  amount: number
  spentOn: string
  description: string
  category: ExpenseCategory
}

export type ExpensePatch = Partial<ExpenseDraft>

function sitePath(organizationId: string, siteId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}`
}

/** Allocated budget, total spent, what remains and spend per category (VIEW_BUDGET). */
export function getBudgetSummary(organizationId: string, siteId: string): Promise<BudgetSummary> {
  return getJson(`${sitePath(organizationId, siteId)}/budget`, budgetSummarySchema)
}

/** The site's expenses, newest first (VIEW_BUDGET). */
export function listExpenses(organizationId: string, siteId: string): Promise<Expense[]> {
  return getJson(`${sitePath(organizationId, siteId)}/expenses`, z.array(expenseSchema))
}

export function createExpense(organizationId: string, siteId: string, draft: ExpenseDraft): Promise<Expense> {
  return sendJson('post', `${sitePath(organizationId, siteId)}/expenses`, draft, 201, expenseSchema)
}

/** Change only the fields sent. */
export function updateExpense(
  organizationId: string,
  siteId: string,
  expenseId: string,
  patch: ExpensePatch,
): Promise<Expense> {
  const path = `${sitePath(organizationId, siteId)}/expenses/${encodeURIComponent(expenseId)}`
  return sendJson('patch', path, patch, 200, expenseSchema)
}

export function deleteExpense(organizationId: string, siteId: string, expenseId: string): Promise<void> {
  return deleteJson(`${sitePath(organizationId, siteId)}/expenses/${encodeURIComponent(expenseId)}`)
}

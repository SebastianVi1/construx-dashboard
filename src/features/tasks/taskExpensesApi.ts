import { z } from 'zod'
import { getJson, sendJson } from '../auth/authApi'
import { expenseSchema, type ExpenseDraft } from '../finance/financeApi'
import { goalPath } from '../goals/goalsApi'
import type { PhaseRef } from './tasksApi'

export const taskExpenseSchema = expenseSchema.extend({
  activityId: z.string(),
  createdByMembershipId: z.string().nullable(),
})
export type TaskExpense = z.infer<typeof taskExpenseSchema>
const taskBudgetSchema = z.object({
  allocatedBudget: z.number().nullable(),
  spent: z.number(),
  remaining: z.number().nullable(),
})

function path(at: PhaseRef, taskId: string) {
  return `${goalPath(at.organizationId, at.siteId, at.goalId)}/activities/${encodeURIComponent(taskId)}`
}

export function getTaskBudget(at: PhaseRef, taskId: string) {
  return getJson(`${path(at, taskId)}/budget`, taskBudgetSchema)
}

export function listTaskExpenses(at: PhaseRef, taskId: string) {
  return getJson(`${path(at, taskId)}/expenses`, z.array(taskExpenseSchema))
}

export function createTaskExpense(at: PhaseRef, taskId: string, draft: ExpenseDraft) {
  return sendJson('post', `${path(at, taskId)}/expenses`, draft, 201, taskExpenseSchema)
}

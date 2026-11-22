import { markGuideStep } from '../guide'
import type { Expense, ExpensePatch, NewExpense } from './financeApi'

export type ExpenseSaveResult = 'created' | 'updated' | 'unchanged'

type SaveExpense = {
  organizationId: string
  /** The expense being edited; without it a new one is created. */
  expense?: Expense
  /** Changed fields of the edited expense; an empty patch sends nothing. */
  patch: (expense: Expense) => ExpensePatch
  draft: () => NewExpense
  create: (draft: NewExpense) => Promise<Expense>
  update: (expenseId: string, patch: ExpensePatch) => Promise<Expense>
}

/**
 * Create or edit an expense. A new expense that saved ticks the guide's
 * "Record an expense" step; edits and failures never do.
 */
export async function saveExpense({ organizationId, expense, patch, draft, create, update }: SaveExpense): Promise<ExpenseSaveResult> {
  if (expense) {
    const changes = patch(expense)
    if (Object.keys(changes).length === 0) return 'unchanged'
    await update(expense.id, changes)
    return 'updated'
  }
  await create(draft())
  markGuideStep('record-expense', organizationId)
  return 'created'
}

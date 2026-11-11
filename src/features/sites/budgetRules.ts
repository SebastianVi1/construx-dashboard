import { z } from 'zod'
import { PESOS, type MoneyConversion } from '../../currency'
import { ApiError } from '../../lib/http'

export type BudgetValidationMessages = {
  required: string
  invalid: string
  decimals: string
  max: string
}

export type AmountIssue = 'required' | 'invalid' | 'decimals' | 'max'

/** Below 10^12 pesos: numeric(14,2) on the backend. */
export const MAX_AMOUNT_MXN = 1e12

/**
 * Money rules shared by budgets, expenses and prices: plain digits with an optional dot, at most two
 * decimals, below `max` pesos once converted with `money` (the user may be typing dollars). Budgets
 * allow 0; expenses and prices must be greater than 0.
 */
export function amountIssue(
  raw: string,
  { allowZero, max = MAX_AMOUNT_MXN, money = PESOS }: { allowZero: boolean; max?: number; money?: MoneyConversion },
): AmountIssue | null {
  const value = raw.trim()
  if (!value) return 'required'
  if (!/^\d+(\.\d+)?$/.test(value)) return 'invalid'
  if (!allowZero && Number(value) === 0) return 'invalid'
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'decimals'
  if (money.toMxn(Number(value)) >= max) return 'max'
  return null
}

/** Budget rules: an amount >= 0. Removing the budget is a separate action, so empty is invalid. */
export function makeBudgetSchema(messages: BudgetValidationMessages, money: MoneyConversion = PESOS) {
  return z.object({
    amount: z.string().superRefine((raw, context) => {
      const issue = amountIssue(raw, { allowZero: true, money })
      if (issue) context.addIssue({ code: 'custom', message: messages[issue] })
    }),
  })
}

/** Phase and task budgets are optional: empty means "no budget", anything typed follows the budget rules. */
export function optionalBudgetField(messages: BudgetValidationMessages, money: MoneyConversion = PESOS) {
  return z.string().superRefine((raw, context) => {
    if (!raw.trim()) return
    const issue = amountIssue(raw, { allowZero: true, money })
    if (issue) context.addIssue({ code: 'custom', message: messages[issue] })
  })
}

/** The validated optional input as the API value in pesos: null clears the budget. */
export function optionalBudgetAmount(raw: string, money: MoneyConversion = PESOS): number | null {
  return raw.trim() ? budgetAmount(raw, money) : null
}

/**
 * Whether the typed amount differs from the stored one, so the dialog only calls the budget endpoint when
 * needed. Compared in the typed currency, so an untouched dollar amount never drifts by a cent.
 */
export function budgetChanged(current: number | null, raw: string, money: MoneyConversion = PESOS): boolean {
  if (!raw.trim()) return current !== null
  return current === null || Number(raw.trim()) !== money.fromMxn(current)
}

export type AllocationIssue = 'budgetExceeded' | 'budgetParentMissing'

/**
 * Budgets nest (site → phases → tasks). The server answers 400 `BUDGET_EXCEEDED` when an amount does not fit
 * in what the parent has left, or drops below what the children hold, and `BUDGET_PARENT_MISSING` when the
 * parent has no budget yet.
 */
export function allocationIssue(error: unknown): AllocationIssue | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null
  if (error.code === 'BUDGET_EXCEEDED') return 'budgetExceeded'
  if (error.code === 'BUDGET_PARENT_MISSING') return 'budgetParentMissing'
  return null
}

/** The validated input as the pesos the API takes. */
export function budgetAmount(raw: string, money: MoneyConversion = PESOS): number {
  return money.toMxn(Number(raw.trim()))
}

/** The stored budget as the dialog's initial text, in the typed currency with cents: "250000.50". */
export function budgetToInput(amount: number | null, money: MoneyConversion = PESOS): string {
  return amount === null ? '' : money.fromMxn(amount).toFixed(2)
}


import { z } from 'zod'
import type { Locale } from '../../i18n'
import { moneyText } from '../materials/priceRules'

export type BudgetValidationMessages = {
  required: string
  invalid: string
  decimals: string
  max: string
}

export type AmountIssue = 'required' | 'invalid' | 'decimals' | 'max'

/**
 * Money rules shared by budgets and expenses, mirroring numeric(14,2) on the backend:
 * plain digits with an optional dot, at most two decimals, below 10^12. Budgets allow 0,
 * expenses must be greater than 0.
 */
export function amountIssue(raw: string, options: { allowZero: boolean }): AmountIssue | null {
  const value = raw.trim()
  if (!value) return 'required'
  if (!/^\d+(\.\d+)?$/.test(value)) return 'invalid'
  if (!options.allowZero && Number(value) === 0) return 'invalid'
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'decimals'
  if (Number(value) >= 1e12) return 'max'
  return null
}

/** Budget rules: an amount >= 0. Removing the budget is a separate action, so empty is invalid. */
export function makeBudgetSchema(messages: BudgetValidationMessages) {
  return z.object({
    amount: z.string().superRefine((raw, context) => {
      const issue = amountIssue(raw, { allowZero: true })
      if (issue) context.addIssue({ code: 'custom', message: messages[issue] })
    }),
  })
}

/** The validated input as the number the API takes. */
export function budgetAmount(raw: string): number {
  return Number(raw.trim())
}

/** The stored budget as the dialog's initial text. */
export function budgetToInput(amount: number | null): string {
  return amount === null ? '' : String(amount)
}

/** Budgets share the price currency (MXN): "$250,000.50". */
export function budgetText(amount: number, locale: Locale): string {
  return moneyText(String(amount), locale)
}

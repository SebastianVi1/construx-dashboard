import { z } from 'zod'
import type { Locale } from '../../i18n'
import { moneyText } from '../materials/priceRules'

export type BudgetValidationMessages = {
  required: string
  invalid: string
  decimals: string
  max: string
}

/**
 * Budget rules, mirroring the backend: an amount >= 0 with at most two decimals that
 * fits numeric(14,2). Removing the budget is a separate action, so empty is invalid.
 */
export function makeBudgetSchema(messages: BudgetValidationMessages) {
  return z.object({
    amount: z.string().superRefine((raw, context) => {
      const value = raw.trim()
      if (!value) context.addIssue({ code: 'custom', message: messages.required })
      else if (!/^\d+(\.\d+)?$/.test(value)) context.addIssue({ code: 'custom', message: messages.invalid })
      else if (!/^\d+(\.\d{1,2})?$/.test(value)) context.addIssue({ code: 'custom', message: messages.decimals })
      else if (Number(value) >= 1e12) context.addIssue({ code: 'custom', message: messages.max })
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

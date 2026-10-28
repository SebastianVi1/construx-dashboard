import { z } from 'zod'
import { amountIssue } from '../sites/budgetRules'
import { expenseCategories, type Expense, type ExpenseCategory, type ExpenseDraft, type ExpensePatch } from './financeApi'

export type ExpenseValidationMessages = {
  amountRequired: string
  amountInvalid: string
  amountDecimals: string
  amountMax: string
  dateRequired: string
  descriptionRequired: string
  descriptionMax: string
  categoryRequired: string
}

export type ExpenseValues = {
  amount: string
  spentOn: string
  description: string
  category: string
}

const amountMessage = {
  required: 'amountRequired',
  invalid: 'amountInvalid',
  decimals: 'amountDecimals',
  max: 'amountMax',
} as const

/** Expense rules, mirroring the backend: amount > 0 (numeric 14,2), a date, a concept of 1..160, a category. */
export function makeExpenseSchema(messages: ExpenseValidationMessages) {
  return z.object({
    amount: z.string().superRefine((raw, context) => {
      const issue = amountIssue(raw, { allowZero: false })
      if (issue) context.addIssue({ code: 'custom', message: messages[amountMessage[issue]] })
    }),
    spentOn: z.string().min(1, messages.dateRequired),
    description: z
      .string()
      .trim()
      .min(1, messages.descriptionRequired)
      .max(160, messages.descriptionMax),
    category: z.string().refine((value) => (expenseCategories as readonly string[]).includes(value), messages.categoryRequired),
  })
}

export function expenseToValues(expense: Expense): ExpenseValues {
  return {
    amount: String(expense.amount),
    spentOn: expense.spentOn,
    description: expense.description,
    category: expense.category,
  }
}

/** Validated values as the create body. */
export function buildExpenseDraft(values: ExpenseValues): ExpenseDraft {
  return {
    amount: Number(values.amount.trim()),
    spentOn: values.spentOn,
    description: values.description.trim(),
    category: values.category as ExpenseCategory,
  }
}

/** Only the fields whose value changed; `{}` means nothing to save. */
export function buildExpensePatch(expense: Expense, values: ExpenseValues): ExpensePatch {
  const draft = buildExpenseDraft(values)
  const patch: ExpensePatch = {}
  if (draft.amount !== expense.amount) patch.amount = draft.amount
  if (draft.spentOn !== expense.spentOn) patch.spentOn = draft.spentOn
  if (draft.description !== expense.description) patch.description = draft.description
  if (draft.category !== expense.category) patch.category = draft.category
  return patch
}

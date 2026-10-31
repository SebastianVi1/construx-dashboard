import { describe, expect, it } from 'bun:test'
import { messages } from '../../../i18n/messages'
import { buildExpenseDraft, buildExpensePatch, expenseToValues, makeExpenseSchema } from '../../../features/finance/expenseForm'
import type { Expense } from '../../../features/finance/financeApi'

const v = messages.en.finance.validation
const valid = { amount: '1200.5', spentOn: '2026-10-01', description: ' Cement ', category: 'MATERIALS' }
const expense: Expense = {
  id: 'e-1',
  projectId: 'p-1',
  amount: 1200.5,
  spentOn: '2026-10-01',
  description: 'Cement',
  category: 'MATERIALS',
}

function errorsOf(values: typeof valid) {
  const result = makeExpenseSchema(v).safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => [issue.path[0], issue.message])
}

describe('expense form', () => {
  it('accepts a positive amount with up to two decimals, a date, a concept and a category', () => {
    expect(errorsOf(valid)).toEqual([])
  })

  it('names each rule that fails', () => {
    expect(errorsOf({ ...valid, amount: '' })).toEqual([['amount', v.amountRequired]])
    expect(errorsOf({ ...valid, amount: '0' })).toEqual([['amount', v.amountInvalid]])
    expect(errorsOf({ ...valid, amount: '-5' })).toEqual([['amount', v.amountInvalid]])
    expect(errorsOf({ ...valid, amount: '1.234' })).toEqual([['amount', v.amountDecimals]])
    expect(errorsOf({ ...valid, amount: '1000000000000' })).toEqual([['amount', v.amountMax]])
    expect(errorsOf({ ...valid, spentOn: '' })).toEqual([['spentOn', v.dateRequired]])
    expect(errorsOf({ ...valid, description: '   ' })).toEqual([['description', v.descriptionRequired]])
    expect(errorsOf({ ...valid, description: 'x'.repeat(161) })).toEqual([['description', v.descriptionMax]])
    expect(errorsOf({ ...valid, category: '' })).toEqual([['category', v.categoryRequired]])
  })

  it('builds the create body with a number and a trimmed concept', () => {
    expect(buildExpenseDraft(valid)).toEqual({
      amount: 1200.5,
      spentOn: '2026-10-01',
      description: 'Cement',
      category: 'MATERIALS',
    })
  })

  it('patches only the fields that changed', () => {
    expect(buildExpensePatch(expense, expenseToValues(expense))).toEqual({})
    expect(buildExpensePatch(expense, { ...expenseToValues(expense), amount: '1300', category: 'LABOR' })).toEqual({
      amount: 1300,
      category: 'LABOR',
    })
    expect(buildExpensePatch(expense, { ...expenseToValues(expense), description: ' Cement ' })).toEqual({})
  })
})

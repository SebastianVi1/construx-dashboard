import { describe, expect, it } from 'bun:test'
import { messages } from '../../i18n/messages'
import { budgetAmount, budgetText, budgetToInput, makeBudgetSchema } from './budgetRules'

const v = messages.en.sites.budget.validation

function errorOf(raw: string) {
  const result = makeBudgetSchema(v).safeParse({ amount: raw })
  return result.success ? null : result.error.issues[0].message
}

describe('site budget schema', () => {
  it('accepts zero, whole numbers and up to two decimals, trimming spaces', () => {
    expect(errorOf(' 250000.5 ')).toBeNull()
    expect(errorOf('0')).toBeNull()
    expect(errorOf('999999999999.99')).toBeNull()
    expect(budgetAmount(' 250000.5 ')).toBe(250000.5)
    expect(budgetAmount('0')).toBe(0)
  })

  it('rejects empty, negative and non-numeric amounts', () => {
    expect(errorOf('')).toBe(v.required)
    expect(errorOf('   ')).toBe(v.required)
    expect(errorOf('-1')).toBe(v.invalid)
    expect(errorOf('abc')).toBe(v.invalid)
    expect(errorOf('1,000')).toBe(v.invalid)
  })

  it('rejects more than two decimals and amounts that do not fit 12 integer digits', () => {
    expect(errorOf('10.001')).toBe(v.decimals)
    expect(errorOf('1000000000000')).toBe(v.max)
  })
})

describe('site budget display', () => {
  it('formats the amount as pesos in both languages', () => {
    expect(budgetText(250000.5, 'en')).toBe('$250,000.50')
    expect(budgetText(250000.5, 'es')).toBe('$250,000.50')
  })

  it('prefills the dialog with the stored amount, or nothing', () => {
    expect(budgetToInput(250000.5)).toBe('250000.5')
    expect(budgetToInput(null)).toBe('')
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import type { Expense, ExpensePatch, NewExpense } from '../../../features/finance/financeApi'
import { saveExpense } from '../../../features/finance/saveExpense'
import { subscribeGuideSteps, type GuideMark } from '../../../features/guide/guideEvents'

const stored: Expense = {
  id: 'e-1',
  projectId: 'site-1',
  amount: 1200,
  spentOn: '2026-11-20',
  description: 'Cement',
  category: 'MATERIALS',
}

const draft: NewExpense = { amount: 500, spentOn: '2026-11-21', description: 'Rebar', category: 'MATERIALS' }

let marks: GuideMark[] = []
let stop = subscribeGuideSteps((mark) => marks.push(mark))
afterEach(() => {
  stop()
  marks = []
  stop = subscribeGuideSteps((mark) => marks.push(mark))
})

function fakes() {
  const calls: string[] = []
  return {
    calls,
    create: async (sent: NewExpense) => {
      calls.push(`create ${sent.description}`)
      return { ...stored, id: 'e-2' }
    },
    update: async (id: string, patch: ExpensePatch) => {
      calls.push(`update ${id} ${JSON.stringify(patch)}`)
      return stored
    },
  }
}

describe('saveExpense', () => {
  it('creates a new expense and ticks "Record an expense" in its Company', async () => {
    const api = fakes()
    const result = await saveExpense({ organizationId: 'org-1', patch: () => ({}), draft: () => draft, ...api })
    expect(result).toBe('created')
    expect(api.calls).toEqual(['create Rebar'])
    expect(marks).toEqual([{ stepId: 'record-expense', organizationId: 'org-1' }])
  })

  it('updates an existing expense without ticking the step', async () => {
    const api = fakes()
    const result = await saveExpense({
      organizationId: 'org-1',
      expense: stored,
      patch: () => ({ amount: 1300 }),
      draft: () => draft,
      ...api,
    })
    expect(result).toBe('updated')
    expect(api.calls).toEqual(['update e-1 {"amount":1300}'])
    expect(marks).toEqual([])
  })

  it('sends nothing and ticks nothing when an edit changes no field', async () => {
    const api = fakes()
    const result = await saveExpense({ organizationId: 'org-1', expense: stored, patch: () => ({}), draft: () => draft, ...api })
    expect(result).toBe('unchanged')
    expect(api.calls).toEqual([])
    expect(marks).toEqual([])
  })

  it('does not tick the step when creating fails, and passes the error on', async () => {
    const failure = new Error('422')
    const result = saveExpense({
      organizationId: 'org-1',
      patch: () => ({}),
      draft: () => draft,
      create: async () => {
        throw failure
      },
      update: async () => stored,
    })
    await expect(result).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})

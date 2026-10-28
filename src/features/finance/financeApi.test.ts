import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { createExpense, deleteExpense, getBudgetSummary, listExpenses, updateExpense, type Expense } from './financeApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const expense: Expense = {
  id: 'e-1',
  projectId: 'p-1',
  amount: 1200.5,
  spentOn: '2026-10-01',
  description: 'Cement',
  category: 'MATERIALS',
}
const summary = {
  allocatedBudget: 10000,
  spent: 1200.5,
  remaining: 8799.5,
  byCategory: [
    { category: 'MATERIALS', amount: 1200.5 },
    { category: 'LABOR', amount: 0 },
    { category: 'EQUIPMENT', amount: 0 },
    { category: 'OTHER', amount: 0 },
  ],
}
const site = '/api/organizations/org-1/projects/p-1'

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('finance API', () => {
  afterEach(() => mock.restore())

  it('getBudgetSummary: reads the site budget totals, allowing no budget', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: summary }) })
    expect(await getBudgetSummary('org-1', 'p-1')).toEqual(summary as never)
    expect(get.mock.calls[0][0]).toBe(`${site}/budget`)

    stubApi({ get: () => ({ status: 200, data: { ...summary, allocatedBudget: null, remaining: null } }) })
    expect((await getBudgetSummary('org-1', 'p-1')).remaining).toBeNull()
  })

  it('listExpenses: gets the site expenses', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [expense] }) })
    expect(await listExpenses('org-1', 'p-1')).toEqual([expense])
    expect(get.mock.calls[0][0]).toBe(`${site}/expenses`)
  })

  it('listExpenses: rejects an unknown category', async () => {
    stubApi({ get: () => ({ status: 200, data: [{ ...expense, category: 'FOOD' }] }) })
    expect(await listExpenses('org-1', 'p-1').catch((error: unknown) => error)).toBeInstanceOf(AuthApiError)
  })

  it('createExpense, updateExpense and deleteExpense hit the expense paths', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: expense }) })
    const draft = { amount: 1200.5, spentOn: '2026-10-01', description: 'Cement', category: 'MATERIALS' as const }
    expect(await createExpense('org-1', 'p-1', draft)).toEqual(expense)
    expect(send.mock.calls[0] as unknown).toEqual([`${site}/expenses`, draft, expect.anything()])

    const updated = stubApi({ send: () => ({ status: 200, data: { ...expense, amount: 5 } }) })
    expect((await updateExpense('org-1', 'p-1', 'e-1', { amount: 5 })).amount).toBe(5)
    expect((updated.send.mock.calls[0] as unknown as [string, unknown])[0]).toBe(`${site}/expenses/e-1`)

    const removed = stubApi({ send: () => ({ status: 204 }) })
    await deleteExpense('org-1', 'p-1', 'e-1')
    expect((removed.send.mock.calls[0] as unknown as [string])[0]).toBe(`${site}/expenses/e-1`)
  })
})

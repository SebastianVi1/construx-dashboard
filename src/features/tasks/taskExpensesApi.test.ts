import { afterEach, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureAuthApi } from '../auth/authApi'
import { createTaskExpense, getTaskBudget, listTaskExpenses } from './taskExpensesApi'

const at = { organizationId: 'org/1', siteId: 'site', goalId: 'phase' }
const path = '/api/organizations/org%2F1/projects/site/goals/phase/activities/task%2F1'
const draft = { amount: 50, spentOn: '2026-10-28', description: 'Concrete', category: 'MATERIALS' as const }
const expense = { ...draft, id: 'expense', projectId: 'site', activityId: 'task/1', createdByMembershipId: 'lead' }
afterEach(() => mock.restore())

it('reads task budget without inventing a remaining amount when no budget exists', async () => {
  const get = mock(async () => ({ status: 200, data: { allocatedBudget: null, spent: 50, remaining: null } }))
  configureAuthApi({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
  expect(await getTaskBudget(at, 'task/1')).toEqual({ allocatedBudget: null, spent: 50, remaining: null })
  expect((get.mock.calls[0] as unknown as [string])[0]).toBe(`${path}/budget`)
})

it('retains expense ownership for per-row actions', async () => {
  const get = mock(async () => ({ status: 200, data: [expense] }))
  configureAuthApi({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
  expect(await listTaskExpenses(at, 'task/1')).toEqual([expense])
  expect((get.mock.calls[0] as unknown as [string])[0]).toBe(`${path}/expenses`)
})

it('records against the task with CSRF and credentials rather than the site collection', async () => {
  const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
  const post = mock(async () => ({ status: 201, data: expense }))
  configureAuthApi({ baseUrl: '/api', client: { get, post } as unknown as AxiosInstance })
  expect(await createTaskExpense(at, 'task/1', draft)).toEqual(expense)
  expect((post.mock.calls[0] as unknown as unknown[])).toEqual([`${path}/expenses`, draft, {
    withCredentials: true, headers: { 'X-XSRF-TOKEN': 'proof', Accept: 'application/problem+json, application/json' },
  }])
})

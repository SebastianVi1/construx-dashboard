import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { createGoal, deleteGoal, goalErrorKind, listGoals, setGoalBudget, shiftGoal, updateGoal, type Goal } from './goalsApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const goal: Goal = {
  id: 'g-1',
  projectId: 'p-1',
  name: 'Foundations',
  startAt: '2026-11-01T08:00:00Z',
  dueAt: '2026-12-15T23:59:00Z',
  activityCount: 5,
  doneCount: 2,
  completed: false,
  allocatedBudget: 500,
  allocatedToActivities: 120.25,
  unallocated: 379.75,
}

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('phases API', () => {
  afterEach(() => mock.restore())

  it('setGoalBudget: puts the amount (or null) on the phase budget endpoint', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...goal, allocatedBudget: 800 } }) })
    expect((await setGoalBudget('org-1', 'p-1', 'g-1', 800)).allocatedBudget).toBe(800)
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals/g-1/budget')
    expect(body).toEqual({ allocatedBudget: 800 })
    await setGoalBudget('org-1', 'p-1', 'g-1', null)
    expect((send.mock.calls[1] as unknown as [string, unknown])[1]).toEqual({ allocatedBudget: null })
  })

  it('reads phases without budget fields (hidden or older backends) as null', async () => {
    const bare: Partial<Goal> = { ...goal }
    delete bare.allocatedBudget
    delete bare.allocatedToActivities
    delete bare.unallocated
    stubApi({ get: () => ({ status: 200, data: [bare] }) })
    expect((await listGoals('org-1', 'p-1'))[0]).toEqual({ ...goal, allocatedBudget: null, allocatedToActivities: null, unallocated: null })
  })

  it('goalErrorKind: tells allocation errors apart from date errors', () => {
    expect(goalErrorKind(new AuthApiError(400, undefined, 'BUDGET_EXCEEDED'))).toBe('budgetExceeded')
    expect(goalErrorKind(new AuthApiError(400, undefined, 'BUDGET_PARENT_MISSING'))).toBe('budgetParentMissing')
  })

  it('includes an optional color when creating a record from the dialog', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: { ...goal, color: '#3b82f6' } }) })
    expect((await createGoal('org-1', 'p-1', { name: goal.name, startAt: goal.startAt, dueAt: goal.dueAt, color: '#3b82f6' })).color).toBe('#3b82f6')
    expect((send.mock.calls[0] as unknown as [string, { color: string }])[1].color).toBe('#3b82f6')
  })

  it('reloads independent colors and resets only the selected bar', async () => {
    const colored = { ...goal, color: '#123abc' }
    const other = { ...goal, id: 'other', color: '#abcdef' }
    const { send } = stubApi({
      get: () => ({ status: 200, data: [colored, other] }),
      send: () => ({ status: 200, data: { ...goal, color: null } }),
    })
    expect(await listGoals('org-1', 'p-1')).toEqual([colored, other])
    expect((await updateGoal('org-1', 'p-1', 'g-1', { color: '' })).color).toBeNull()
    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ color: '' })
  })

  it('persists an individual bar color and reads it from the response', async () => {
    const colored = { ...goal, color: '#123abc' }
    const { send } = stubApi({ send: () => ({ status: 200, data: colored }) })
    expect(await updateGoal('org-1', 'p-1', 'g-1', { color: '#123abc' })).toEqual(colored)
    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ color: '#123abc' })
  })

  it('listGoals: gets the phases of a site, allowing null progress counts', async () => {
    const hidden = { ...goal, activityCount: null, doneCount: null }
    const { get } = stubApi({ get: () => ({ status: 200, data: [goal, hidden] }) })

    expect(await listGoals('org-1', 'p-1')).toEqual([goal, hidden])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects/p-1/goals')
  })

  it('createGoal: posts the trimmed name, the start and due instants with CSRF and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: goal }) })

    expect(await createGoal('org-1', 'p-1', {
      name: '  Foundations ',
      startAt: '2026-11-01T08:00:00.000Z',
      dueAt: '2026-12-15T23:59:00.000Z',
    })).toEqual(goal)
    const [url, body, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals')
    expect(body).toEqual({ name: 'Foundations', startAt: '2026-11-01T08:00:00.000Z', dueAt: '2026-12-15T23:59:00.000Z' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('updateGoal: patches only the given fields of one phase', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...goal, name: 'Slab' } }) })

    expect((await updateGoal('org-1', 'p-1', 'g/1', { name: 'Slab' })).name).toBe('Slab')
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals/g%2F1')
    expect(body).toEqual({ name: 'Slab' })
  })

  it('updateGoal: can move the start alone', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: goal }) })
    await updateGoal('org-1', 'p-1', 'g-1', { startAt: '2026-11-02T08:00:00.000Z' })

    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ startAt: '2026-11-02T08:00:00.000Z' })
  })

  it('shiftGoal: posts the day offset to the shift endpoint and expects 200', async () => {
    const moved = { ...goal, startAt: '2026-11-04T08:00:00Z', dueAt: '2026-12-18T23:59:00Z' }
    const { send } = stubApi({ send: () => ({ status: 200, data: moved }) })

    expect(await shiftGoal('org-1', 'p-1', 'g/1', 3)).toEqual(moved)
    const [url, body, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals/g%2F1/shift')
    expect(body).toEqual({ days: 3 })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('deleteGoal: deletes one phase and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })
    await deleteGoal('org-1', 'p-1', 'g-1')

    expect((send.mock.calls[0] as unknown as [string])[0]).toBe('/api/organizations/org-1/projects/p-1/goals/g-1')
  })
})

describe('phase error kinds', () => {
  it('maps a phase failure to a message kind', () => {
    expect(goalErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('beforeTasks')
    expect(goalErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalid')
    expect(goalErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('hasTasks')
    expect(goalErrorKind(new AuthApiError(401))).toBe('session')
    expect(goalErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(goalErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(goalErrorKind(new AuthApiError(500))).toBe('generic')
    expect(goalErrorKind(new Error('boom'))).toBe('generic')
  })
})

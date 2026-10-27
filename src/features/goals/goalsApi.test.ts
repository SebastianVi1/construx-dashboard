import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { createGoal, deleteGoal, goalErrorKind, listGoals, updateGoal, type Goal } from './goalsApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const goal: Goal = {
  id: 'g-1',
  projectId: 'p-1',
  name: 'Foundations',
  dueAt: '2026-12-15T23:59:00Z',
  activityCount: 5,
  doneCount: 2,
  completed: false,
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

  it('listGoals: gets the phases of a site, allowing null progress counts', async () => {
    const hidden = { ...goal, activityCount: null, doneCount: null }
    const { get } = stubApi({ get: () => ({ status: 200, data: [goal, hidden] }) })

    expect(await listGoals('org-1', 'p-1')).toEqual([goal, hidden])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects/p-1/goals')
  })

  it('createGoal: posts the trimmed name and the due instant with CSRF and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: goal }) })

    expect(await createGoal('org-1', 'p-1', { name: '  Foundations ', dueAt: '2026-12-15T23:59:00.000Z' })).toEqual(goal)
    const [url, body, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals')
    expect(body).toEqual({ name: 'Foundations', dueAt: '2026-12-15T23:59:00.000Z' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('updateGoal: patches only the given fields of one phase', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...goal, name: 'Slab' } }) })

    expect((await updateGoal('org-1', 'p-1', 'g/1', { name: 'Slab' })).name).toBe('Slab')
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/goals/g%2F1')
    expect(body).toEqual({ name: 'Slab' })
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

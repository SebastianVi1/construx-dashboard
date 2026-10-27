import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import {
  completeTask,
  createTask,
  deleteTask,
  listMyTasks,
  listTasks,
  reassignTask,
  startTask,
  taskErrorKind,
  updateTask,
  type Task,
} from './tasksApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const task: Task = {
  id: 't-1',
  goalId: 'g-1',
  projectId: 'p-1',
  name: 'Pour slab level 1',
  startAt: '2026-11-20T08:00:00Z',
  dueAt: '2026-12-01T18:00:00Z',
  status: 'TODO',
  completedAt: null,
  assignee: { accessId: 'a-1', membershipId: 'm-1', fullName: 'Ana Perez' },
}
const base = '/api/organizations/org-1/projects/p-1/goals/g-1/activities'

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

const at = { organizationId: 'org-1', siteId: 'p-1', goalId: 'g-1' }

describe('tasks API', () => {
  afterEach(() => mock.restore())

  it('listTasks: gets the tasks of a phase without filters', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [task] }) })

    expect(await listTasks(at)).toEqual([task])
    expect(get.mock.calls[0][0]).toBe(base)
  })

  it('listTasks: sends the status and assignee filters as query params', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [] }) })
    await listTasks(at, { status: 'IN_PROGRESS', assigneeAccessId: 'a 1' })

    expect(get.mock.calls[0][0]).toBe(`${base}?status=IN_PROGRESS&assigneeAccessId=a+1`)
  })

  it('listTasks: accepts a done task with completedAt and an assignee without a name', async () => {
    const done = { ...task, status: 'DONE', completedAt: '2026-11-30T10:00:00Z', assignee: { ...task.assignee, fullName: null } }
    stubApi({ get: () => ({ status: 200, data: [done] }) })

    expect(await listTasks(at)).toEqual([done as Task])
  })

  it('createTask: posts name, start and due instants and assignee with CSRF and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: task }) })
    await createTask(at, {
      name: ' Pour slab ',
      startAt: '2026-11-20T08:00:00.000Z',
      dueAt: '2026-12-01T18:00:00.000Z',
      assigneeAccessId: 'a-1',
    })

    const [url, body, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe(base)
    expect(body).toEqual({
      name: 'Pour slab',
      startAt: '2026-11-20T08:00:00.000Z',
      dueAt: '2026-12-01T18:00:00.000Z',
      assigneeAccessId: 'a-1',
    })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('updateTask: patches name and due only', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: task }) })
    await updateTask(at, 't-1', { dueAt: '2026-12-02T18:00:00.000Z' })

    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe(`${base}/t-1`)
    expect(body).toEqual({ dueAt: '2026-12-02T18:00:00.000Z' })
  })

  it('updateTask: moves start and due together in one patch', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: task }) })
    await updateTask(at, 't-1', { startAt: '2026-11-21T08:00:00.000Z', dueAt: '2026-12-02T18:00:00.000Z' })

    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({
      startAt: '2026-11-21T08:00:00.000Z',
      dueAt: '2026-12-02T18:00:00.000Z',
    })
  })

  it('reassignTask: puts the new assignee access id', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: task }) })
    await reassignTask(at, 't-1', 'a-2')

    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe(`${base}/t-1/assignee`)
    expect(body).toEqual({ assigneeAccessId: 'a-2' })
  })

  it('startTask and completeTask: post to the transition and parse the updated task', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...task, status: 'IN_PROGRESS' } }) })

    expect((await startTask(at, 't-1')).status).toBe('IN_PROGRESS')
    await completeTask(at, 't-1')
    expect((send.mock.calls[0] as unknown as [string])[0]).toBe(`${base}/t-1/start`)
    expect((send.mock.calls[1] as unknown as [string])[0]).toBe(`${base}/t-1/complete`)
  })

  it('deleteTask: deletes one task and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })
    await deleteTask(at, 't-1')

    expect((send.mock.calls[0] as unknown as [string])[0]).toBe(`${base}/t-1`)
  })

  it('listMyTasks: gets the caller’s tasks across sites, with an optional status filter', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [task] }) })

    expect(await listMyTasks('org-1')).toEqual([task])
    await listMyTasks('org-1', 'DONE')
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/activities/mine')
    expect(get.mock.calls[1][0]).toBe('/api/organizations/org-1/activities/mine?status=DONE')
  })
})

describe('task error kinds', () => {
  it('maps a task failure to a message kind', () => {
    expect(taskErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('afterPhase')
    expect(taskErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalid')
    expect(taskErrorKind(new AuthApiError(404, undefined, 'NOT_FOUND'))).toBe('notFound')
    expect(taskErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('transition')
    expect(taskErrorKind(new AuthApiError(401))).toBe('session')
    expect(taskErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(taskErrorKind(new AuthApiError(500))).toBe('generic')
    expect(taskErrorKind('boom')).toBe('generic')
  })
})

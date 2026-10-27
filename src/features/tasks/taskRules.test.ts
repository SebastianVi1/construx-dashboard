import { describe, expect, it } from 'bun:test'
import type { MyAccess } from '../permissions'
import { groupByStatus, taskActions } from './taskRules'
import type { Task } from './tasksApi'

const task: Task = {
  id: 't-1',
  goalId: 'g-1',
  projectId: 'p-1',
  name: 'Pour slab',
  dueAt: '2026-12-01T18:00:00Z',
  status: 'TODO',
  completedAt: null,
  assignee: { accessId: 'a-1', membershipId: 'm-worker', fullName: 'Ana' },
}

function role(membershipId: string, grants: Array<[string, 'ORGANIZATION' | 'PROJECT' | 'OWN']>): MyAccess {
  return {
    membershipId,
    role: { code: 'X', name: 'X' },
    permissions: grants.map(([action, scope]) => ({ action, scope })),
  }
}

const member = role('m-member', [
  ['MANAGE_ACTIVITY', 'ORGANIZATION'],
  ['ASSIGN_ACTIVITY', 'ORGANIZATION'],
])
const siteLead = role('m-lead', [['MANAGE_ACTIVITY', 'PROJECT']])
const worker = role('m-worker', [
  ['VIEW_ACTIVITY', 'PROJECT'],
  ['MANAGE_ACTIVITY', 'OWN'],
])
const otherWorker = role('m-other', [
  ['VIEW_ACTIVITY', 'PROJECT'],
  ['MANAGE_ACTIVITY', 'OWN'],
])

describe('taskActions', () => {
  it('ORGANIZATION scope can start, complete, edit, reassign and delete any task', () => {
    expect(taskActions(member, task, { onSite: false })).toEqual({
      start: true,
      complete: true,
      edit: true,
      reassign: true,
      remove: true,
    })
  })

  it('PROJECT scope moves tasks on a site the caller is on, but not elsewhere', () => {
    expect(taskActions(siteLead, task, { onSite: true })).toMatchObject({ start: true, complete: true, edit: true })
    expect(taskActions(siteLead, task, { onSite: false })).toMatchObject({ start: false, complete: false, edit: false })
  })

  it('OWN scope starts and completes only the caller’s own task and never edits it', () => {
    expect(taskActions(worker, task, { onSite: true })).toEqual({
      start: true,
      complete: true,
      edit: false,
      reassign: false,
      remove: false,
    })
    expect(taskActions(otherWorker, task, { onSite: true })).toMatchObject({ start: false, complete: false })
  })

  it('offers only the moves the status allows', () => {
    expect(taskActions(member, { ...task, status: 'IN_PROGRESS' }, {})).toMatchObject({ start: false, complete: true })
    expect(taskActions(member, { ...task, status: 'DONE' }, {})).toMatchObject({ start: false, complete: false })
  })

  it('offers nothing while permissions are unknown', () => {
    expect(Object.values(taskActions(null, task, {})).some(Boolean)).toBe(false)
  })
})

describe('groupByStatus', () => {
  it('groups tasks as to do, in progress, done, each by due date', () => {
    const tasks: Task[] = [
      { ...task, id: 'late', dueAt: '2026-12-09T00:00:00Z' },
      { ...task, id: 'done', status: 'DONE' },
      { ...task, id: 'early', dueAt: '2026-11-02T00:00:00Z' },
      { ...task, id: 'busy', status: 'IN_PROGRESS' },
    ]

    expect(groupByStatus(tasks).map((group) => [group.status, group.tasks.map((item) => item.id)])).toEqual([
      ['TODO', ['early', 'late']],
      ['IN_PROGRESS', ['busy']],
      ['DONE', ['done']],
    ])
  })

  it('keeps empty groups so the board layout stays stable', () => {
    expect(groupByStatus([]).map((group) => group.tasks.length)).toEqual([0, 0, 0])
  })
})

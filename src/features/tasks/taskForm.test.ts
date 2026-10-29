import { describe, expect, it } from 'bun:test'
import { instantToLocalInput } from '../goals/dueAt'
import { buildTaskChanges, makeTaskSchema } from './taskForm'
import type { Task } from './tasksApi'

const messages = {
  nameRequired: 'name',
  nameMax: 'max',
  startRequired: 'start',
  dueRequired: 'due',
  startAfterDue: 'order',
  beforePhase: 'before',
  afterPhase: 'after',
  assigneeRequired: 'assignee',
}
const task: Task = {
  id: 't-1',
  goalId: 'g-1',
  projectId: 'p-1',
  name: 'Pour slab',
  startAt: '2026-11-20T08:00:00Z',
  dueAt: '2026-12-01T18:00:00Z',
  status: 'TODO',
  completedAt: null,
  assignee: { accessId: 'a-1', membershipId: 'm-1', fullName: 'Ana' },
  allocatedBudget: null,
}

type Values = { name: string; startAt: string; dueAt: string; assigneeAccessId: string }

function issues(values: Values, phase?: { startAt: string; dueAt: string }) {
  return makeTaskSchema(messages, phase).safeParse(values).error?.issues.map((issue) => issue.message) ?? []
}

const phase = { startAt: new Date(2026, 11, 1, 8, 0).toISOString(), dueAt: new Date(2026, 11, 15, 18, 0).toISOString() }
const valid = { name: 'Pour', startAt: '2026-12-02T08:00', dueAt: '2026-12-10T18:00', assigneeAccessId: 'a-1' }

describe('task form', () => {
  it('requires a name, a start, a due date and time and an assignee', () => {
    expect(issues({ name: '', startAt: '', dueAt: '', assigneeAccessId: '' })).toEqual(['name', 'start', 'due', 'assignee'])
    expect(issues(valid)).toEqual([])
  })

  it('rejects a start after the due', () => {
    expect(issues({ ...valid, startAt: '2026-12-10T18:01' }, phase)).toEqual(['order'])
    expect(issues({ ...valid, startAt: '2026-12-10T18:00' }, phase)).toEqual([])
  })

  it('rejects dates outside the phase, like the server', () => {
    expect(issues({ ...valid, dueAt: '2026-12-15T18:01' }, phase)).toEqual(['after'])
    expect(issues({ ...valid, dueAt: '2026-12-15T18:00' }, phase)).toEqual([])
    expect(issues({ ...valid, startAt: '2026-12-01T07:59' }, phase)).toEqual(['before'])
    expect(issues({ ...valid, startAt: '2026-12-01T08:00' }, phase)).toEqual([])
  })

  it('splits an edit into the PATCH fields and a reassignment, sending only changes', () => {
    const unchanged = {
      name: 'Pour slab',
      startAt: instantToLocalInput(task.startAt),
      dueAt: instantToLocalInput(task.dueAt),
      assigneeAccessId: 'a-1',
    }
    expect(buildTaskChanges(task, unchanged)).toEqual({ patch: {}, assigneeAccessId: null })

    expect(buildTaskChanges(task, { ...unchanged, name: ' Pour slab L2 ', assigneeAccessId: 'a-2' })).toEqual({
      patch: { name: 'Pour slab L2' },
      assigneeAccessId: 'a-2',
    })
    expect(buildTaskChanges(task, { ...unchanged, startAt: '2026-11-21T08:00' })).toEqual({
      patch: { startAt: new Date(2026, 10, 21, 8, 0).toISOString() },
      assigneeAccessId: null,
    })
  })

  it('patches a changed color, sends an empty color to reset it, and skips an unchanged one', () => {
    const same = {
      name: task.name,
      startAt: instantToLocalInput(task.startAt),
      dueAt: instantToLocalInput(task.dueAt),
      assigneeAccessId: 'a-1',
    }
    expect(buildTaskChanges(task, { ...same, color: '#3b82f6' }).patch).toEqual({ color: '#3b82f6' })
    expect(buildTaskChanges({ ...task, color: '#3b82f6' }, { ...same, color: '' }).patch).toEqual({ color: '' })
    expect(buildTaskChanges({ ...task, color: '#3b82f6' }, { ...same, color: '#3b82f6' }).patch).toEqual({})
  })
})

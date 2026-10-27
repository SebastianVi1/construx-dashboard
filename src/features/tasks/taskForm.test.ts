import { describe, expect, it } from 'bun:test'
import { instantToLocalInput } from '../goals/dueAt'
import { buildTaskChanges, makeTaskSchema } from './taskForm'
import type { Task } from './tasksApi'

const messages = {
  nameRequired: 'name',
  nameMax: 'max',
  dueRequired: 'due',
  afterPhase: 'after',
  assigneeRequired: 'assignee',
}
const task: Task = {
  id: 't-1',
  goalId: 'g-1',
  projectId: 'p-1',
  name: 'Pour slab',
  dueAt: '2026-12-01T18:00:00Z',
  status: 'TODO',
  completedAt: null,
  assignee: { accessId: 'a-1', membershipId: 'm-1', fullName: 'Ana' },
}

function issues(values: { name: string; dueAt: string; assigneeAccessId: string }, phaseDueAt?: string) {
  return makeTaskSchema(messages, phaseDueAt).safeParse(values).error?.issues.map((issue) => issue.message) ?? []
}

describe('task form', () => {
  it('requires a name, a due date and time and an assignee', () => {
    expect(issues({ name: '', dueAt: '', assigneeAccessId: '' })).toEqual(['name', 'due', 'assignee'])
    expect(issues({ name: 'Pour', dueAt: '2026-12-01T09:00', assigneeAccessId: 'a-1' })).toEqual([])
  })

  it('rejects a due date after the phase’s, like the server', () => {
    const phaseDue = new Date(2026, 11, 15, 18, 0).toISOString()
    expect(issues({ name: 'Pour', dueAt: '2026-12-15T18:01', assigneeAccessId: 'a-1' }, phaseDue)).toEqual(['after'])
    expect(issues({ name: 'Pour', dueAt: '2026-12-15T18:00', assigneeAccessId: 'a-1' }, phaseDue)).toEqual([])
  })

  it('splits an edit into the PATCH fields and a reassignment, sending only changes', () => {
    const unchanged = { name: 'Pour slab', dueAt: instantToLocalInput(task.dueAt), assigneeAccessId: 'a-1' }
    expect(buildTaskChanges(task, unchanged)).toEqual({ patch: {}, assigneeAccessId: null })

    expect(buildTaskChanges(task, { ...unchanged, name: ' Pour slab L2 ', assigneeAccessId: 'a-2' })).toEqual({
      patch: { name: 'Pour slab L2' },
      assigneeAccessId: 'a-2',
    })
  })
})

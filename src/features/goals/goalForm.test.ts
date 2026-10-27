import { describe, expect, it } from 'bun:test'
import { buildGoalPatch, makeGoalSchema } from './goalForm'
import { instantToLocalInput } from './dueAt'
import type { Goal } from './goalsApi'

const messages = { nameRequired: 'name', nameMax: 'max', startRequired: 'start', dueRequired: 'due', startAfterDue: 'order' }
const goal: Goal = {
  id: 'g-1',
  projectId: 'p-1',
  name: 'Foundations',
  startAt: '2026-11-01T08:00:00Z',
  dueAt: '2026-12-15T23:59:00Z',
  activityCount: 0,
  doneCount: 0,
  completed: false,
}

describe('phase form', () => {
  const schema = makeGoalSchema(messages)
  const issues = (values: { name: string; startAt: string; dueAt: string }) =>
    schema.safeParse(values).error?.issues.map((issue) => issue.message) ?? []

  it('requires a name of 1 to 160 characters, a start and a due date and time', () => {
    expect(issues({ name: '  ', startAt: '', dueAt: '' })).toEqual(['name', 'start', 'due'])
    expect(issues({ name: 'x'.repeat(161), startAt: '2026-12-01T08:00', dueAt: '2026-12-15T18:00' })).toEqual(['max'])
    expect(issues({ name: 'Slab', startAt: '2026-12-01T08:00', dueAt: '2026-12-15' })).toEqual(['due'])
    expect(issues({ name: 'Slab', startAt: '2026-12-01T08:00', dueAt: '2026-12-15T18:00' })).toEqual([])
  })

  it('rejects a start after the due, accepting the same instant', () => {
    expect(issues({ name: 'Slab', startAt: '2026-12-15T18:01', dueAt: '2026-12-15T18:00' })).toEqual(['order'])
    expect(issues({ name: 'Slab', startAt: '2026-12-15T18:00', dueAt: '2026-12-15T18:00' })).toEqual([])
  })

  it('patches only what changed', () => {
    const same = { name: 'Foundations ', startAt: instantToLocalInput(goal.startAt), dueAt: instantToLocalInput(goal.dueAt) }
    expect(buildGoalPatch(goal, same)).toEqual({})

    const patch = buildGoalPatch(goal, { ...same, name: 'Slab', dueAt: '2027-01-10T08:00' })
    expect(patch).toEqual({ name: 'Slab', dueAt: new Date(2027, 0, 10, 8, 0).toISOString() })
    expect(buildGoalPatch(goal, { ...same, startAt: '2026-11-03T08:00' })).toEqual({
      startAt: new Date(2026, 10, 3, 8, 0).toISOString(),
    })
  })
})

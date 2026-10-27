import { describe, expect, it } from 'bun:test'
import { buildGoalPatch, makeGoalSchema } from './goalForm'
import { instantToLocalInput } from './dueAt'
import type { Goal } from './goalsApi'

const messages = { nameRequired: 'name', nameMax: 'max', dueRequired: 'due' }
const goal: Goal = {
  id: 'g-1',
  projectId: 'p-1',
  name: 'Foundations',
  dueAt: '2026-12-15T23:59:00Z',
  activityCount: 0,
  doneCount: 0,
  completed: false,
}

describe('phase form', () => {
  it('requires a name of 1 to 160 characters and a due date and time', () => {
    const schema = makeGoalSchema(messages)
    const issues = (values: { name: string; dueAt: string }) =>
      schema.safeParse(values).error?.issues.map((issue) => issue.message) ?? []

    expect(issues({ name: '  ', dueAt: '' })).toEqual(['name', 'due'])
    expect(issues({ name: 'x'.repeat(161), dueAt: '2026-12-15T18:00' })).toEqual(['max'])
    expect(issues({ name: 'Slab', dueAt: '2026-12-15' })).toEqual(['due'])
    expect(issues({ name: 'Slab', dueAt: '2026-12-15T18:00' })).toEqual([])
  })

  it('patches only what changed', () => {
    const same = { name: 'Foundations ', dueAt: instantToLocalInput(goal.dueAt) }
    expect(buildGoalPatch(goal, same)).toEqual({})

    const patch = buildGoalPatch(goal, { name: 'Slab', dueAt: '2027-01-10T08:00' })
    expect(patch).toEqual({ name: 'Slab', dueAt: new Date(2027, 0, 10, 8, 0).toISOString() })
  })
})

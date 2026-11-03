import { describe, expect, it } from 'bun:test'
import { buildGoalPatch, makeGoalSchema } from '../../../features/goals/goalForm'
import { instantToLocalInput } from '../../../features/goals/dueAt'
import type { Goal } from '../../../features/goals/goalsApi'

const messages = {
  nameRequired: 'name',
  nameMax: 'max',
  startRequired: 'start',
  dueRequired: 'due',
  startAfterDue: 'order',
  startPast: 'startPast',
  duePast: 'duePast',
}
const goal: Goal = {
  id: 'g-1',
  projectId: 'p-1',
  name: 'Foundations',
  startAt: '2026-11-01T08:00:00Z',
  dueAt: '2026-12-15T23:59:00Z',
  activityCount: 0,
  doneCount: 0,
  completed: false,
  allocatedBudget: null,
  allocatedToActivities: null,
  unallocated: null,
}

describe('phase form', () => {
  const schema = makeGoalSchema(messages)
  const issues = (values: { name: string; startAt: string; dueAt: string }) =>
    schema.safeParse(values).error?.issues.map((issue) => issue.message) ?? []

  it('requires a name of 1 to 160 characters, a start and a due date', () => {
    expect(issues({ name: '  ', startAt: '', dueAt: '' })).toEqual(['name', 'start', 'due'])
    expect(issues({ name: 'x'.repeat(161), startAt: '2026-12-01', dueAt: '2026-12-15' })).toEqual(['max'])
    expect(issues({ name: 'Slab', startAt: '2026-12-01', dueAt: '2026-12-15T18:00' })).toEqual(['due'])
    expect(issues({ name: 'Slab', startAt: '2026-12-01', dueAt: '2026-12-15' })).toEqual([])
  })

  it('rejects a start after the due, accepting the same day', () => {
    expect(issues({ name: 'Slab', startAt: '2026-12-16', dueAt: '2026-12-15' })).toEqual(['order'])
    expect(issues({ name: 'Slab', startAt: '2026-12-15', dueAt: '2026-12-15' })).toEqual([])
  })

  it('rejects dates before notBefore when creating', () => {
    const notBefore = new Date(2027, 0, 1).getTime()
    const creating = makeGoalSchema(messages, 'color', undefined, notBefore)
    const issuesWith = (values: { name: string; startAt: string; dueAt: string }) =>
      creating.safeParse(values).error?.issues.map((issue) => issue.message) ?? []
    expect(issuesWith({ name: 'Slab', startAt: '2026-12-01', dueAt: '2026-12-15' })).toEqual(['startPast', 'duePast'])
    expect(issuesWith({ name: 'Slab', startAt: '2027-01-01', dueAt: '2027-01-15' })).toEqual([])
  })

  it('patches only what changed (compared at the day level)', () => {
    const same = { name: 'Foundations ', startAt: instantToLocalInput(goal.startAt), dueAt: instantToLocalInput(goal.dueAt) }
    expect(buildGoalPatch(goal, same)).toEqual({})

    const patch = buildGoalPatch(goal, { ...same, name: 'Slab', dueAt: '2027-01-10' })
    expect(patch).toEqual({ name: 'Slab', dueAt: new Date(2027, 0, 10).toISOString() })
    expect(buildGoalPatch(goal, { ...same, startAt: '2026-11-03' })).toEqual({
      startAt: new Date(2026, 10, 3).toISOString(),
    })
  })

  it('patches a changed color, sends an empty color to reset it, and skips an unchanged one', () => {
    const same = { name: goal.name, startAt: instantToLocalInput(goal.startAt), dueAt: instantToLocalInput(goal.dueAt) }
    expect(buildGoalPatch(goal, { ...same, color: '#3b82f6' })).toEqual({ color: '#3b82f6' })
    expect(buildGoalPatch({ ...goal, color: '#3b82f6' }, { ...same, color: '' })).toEqual({ color: '' })
    expect(buildGoalPatch({ ...goal, color: '#3b82f6' }, { ...same, color: '#3b82f6' })).toEqual({})
  })

  it('validates an optional budget only when the budget messages are given', () => {
    const budget = { required: 'required', invalid: 'invalid', decimals: 'decimals', max: 'max' }
    const withBudget = makeGoalSchema(messages, 'color', budget)
    const valid = { name: 'Slab', startAt: '2026-12-01', dueAt: '2026-12-15' }
    expect(withBudget.safeParse({ ...valid, budget: '' }).success).toBe(true)
    expect(withBudget.safeParse({ ...valid, budget: '2500.5' }).success).toBe(true)
    expect(withBudget.safeParse({ ...valid, budget: '1.234' }).error?.issues[0].message).toBe('decimals')
    expect(schema.safeParse({ ...valid, budget: 'anything' }).success).toBe(true)
  })

  it('never puts the budget in the phase patch', () => {
    const same = { name: goal.name, startAt: instantToLocalInput(goal.startAt), dueAt: instantToLocalInput(goal.dueAt) }
    expect(buildGoalPatch(goal, { ...same, budget: '100' })).toEqual({})
  })
})

import { describe, expect, it } from 'bun:test'
import { taskMoneyActions } from './taskMoney'
import type { MyAccess } from '../permissions/can'
import type { Task } from './tasksApi'

const task = { projectId: 'site', assignees: [
  { membershipId: 'lead', taskRole: 'LEAD' },
  { membershipId: 'foreman', taskRole: 'FOREMAN' },
  { membershipId: 'crew', taskRole: 'CREW' },
] } as Task
const access = (membershipId: string, permissions: MyAccess['permissions'] = []): MyAccess => ({
  membershipId, role: { code: 'WORKER', name: 'Worker' }, permissions,
})

describe('task spending affordances', () => {
  it('allows the current Lead to see and record, but manage only their own expenses', () => {
    const actions = taskMoneyActions(access('lead'), task)
    expect(actions.view).toBe(true)
    expect(actions.record).toBe(true)
    expect(actions.manage('lead')).toBe(true)
    expect(actions.manage('someone-else')).toBe(false)
    expect(actions.manage(null)).toBe(false)
  })
  it('hides money from Foreman, Crew, former Lead and anonymous users', () => {
    for (const caller of [access('foreman'), access('crew'), access('former'), null]) {
      const actions = taskMoneyActions(caller, task)
      expect(actions.view).toBe(false)
      expect(actions.record).toBe(false)
      expect(actions.manage('lead')).toBe(false)
    }
  })
  it('keeps budget view and management permissions distinct', () => {
    const viewer = taskMoneyActions(access('finance', [{ action: 'VIEW_BUDGET', scope: 'ORGANIZATION' }]), task)
    expect(viewer.view).toBe(true)
    expect(viewer.record).toBe(false)
    expect(viewer.manage('lead')).toBe(false)
    const manager = taskMoneyActions(access('owner', [
      { action: 'VIEW_BUDGET', scope: 'ORGANIZATION' },
      { action: 'MANAGE_BUDGET', scope: 'ORGANIZATION' },
    ]), task)
    expect(manager.view).toBe(true)
    expect(manager.record).toBe(true)
    expect(manager.manage('lead')).toBe(true)
  })
})

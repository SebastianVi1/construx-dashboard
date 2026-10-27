import { describe, expect, it } from 'bun:test'
import { sectionForPath, workspaceNavItems } from './workspaceNav'

describe('workspaceNavItems', () => {
  it('always lists sites first', () => {
    expect(workspaceNavItems({ seesOwnTasks: false, managesMembers: false }).map((item) => item.key)).toEqual(['sites'])
  })

  it('adds my tasks and team only when the role allows them', () => {
    expect(workspaceNavItems({ seesOwnTasks: true, managesMembers: true }).map((item) => item.to)).toEqual([
      '/sites',
      '/tasks',
      '/members',
    ])
    expect(workspaceNavItems({ seesOwnTasks: false, managesMembers: true }).map((item) => item.key)).toEqual([
      'sites',
      'members',
    ])
  })
})

describe('sectionForPath', () => {
  it('maps a section root to itself', () => {
    expect(sectionForPath('/sites')).toEqual({ key: 'sites', to: '/sites', isRoot: true })
    expect(sectionForPath('/tasks')).toEqual({ key: 'myTasks', to: '/tasks', isRoot: true })
    expect(sectionForPath('/members/')).toEqual({ key: 'members', to: '/members', isRoot: true })
    expect(sectionForPath('/account')).toEqual({ key: 'account', to: '/account', isRoot: true })
  })

  it('keeps a nested page under its section', () => {
    expect(sectionForPath('/sites/42')).toEqual({ key: 'sites', to: '/sites', isRoot: false })
  })

  it('does not match a path that only shares a prefix', () => {
    expect(sectionForPath('/sitesmap')).toBeNull()
    expect(sectionForPath('/')).toBeNull()
  })
})

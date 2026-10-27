import { describe, expect, it } from 'bun:test'
import { messages } from '../../i18n/messages'
import { roleLabel } from '../permissions/roles'
import { assignableMembers, siteProgress } from './siteHelpers'

describe('siteProgress', () => {
  it('is null when the caller cannot see the tasks', () => {
    expect(siteProgress({ activityCount: null, doneCount: null })).toBeNull()
    expect(siteProgress({ activityCount: 3, doneCount: null })).toBeNull()
  })

  it('gives done, total and a rounded percent', () => {
    expect(siteProgress({ activityCount: 12, doneCount: 4 })).toEqual({ done: 4, total: 12, percent: 33 })
    expect(siteProgress({ activityCount: 0, doneCount: 0 })).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('assignableMembers', () => {
  it('lists only members who are not on the site yet', () => {
    const members = [{ membershipId: 'm-1' }, { membershipId: 'm-2' }, { membershipId: 'm-3' }]
    const access = [{ membershipId: 'm-2' }]
    expect(assignableMembers(members, access).map((member) => member.membershipId)).toEqual(['m-1', 'm-3'])
  })
})

describe('roleLabel', () => {
  it('localizes a seeded role by code and keeps a custom role name', () => {
    expect(roleLabel({ code: 'WORKER', name: 'Trabajador' }, messages.en.roles)).toBe('Worker')
    expect(roleLabel({ code: 'WORKER', name: 'Trabajador' }, messages.es.roles)).toBe('Trabajador')
    expect(roleLabel({ code: 'FOREMAN', name: 'Capataz' }, messages.en.roles)).toBe('Capataz')
  })
})

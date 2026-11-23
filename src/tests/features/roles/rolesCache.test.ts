import { afterEach, describe, expect, it } from 'bun:test'
import {
  onRolesChanged,
  roleDeleted,
  roleKey,
  rolesChanged,
  rolesKey,
  summaryOf,
  withoutRole,
  withRole,
} from '../../../features/roles/rolesCache'
import type { RoleDetail, RoleSummary } from '../../../features/roles/rolesApi'
import { clearSessionValues, hasSessionValue, readSessionValue, writeSessionValue } from '../../../lib/sessionCache'

function summary(code: string, flags: Partial<RoleSummary> = {}): RoleSummary {
  return {
    id: `id-${code}`,
    code,
    kind: 'CUSTOM',
    name: code,
    names: { en: code, es: code },
    description: null,
    system: false,
    customized: false,
    memberCount: 0,
    pendingInvitationCount: 0,
    editable: true,
    assignable: true,
    version: 1,
    ...flags,
  }
}

afterEach(() => clearSessionValues())

describe('roles cache keys', () => {
  it('names the list and one role per company', () => {
    expect(rolesKey('org-1')).toBe('org-1:roles')
    expect(roleKey('org-1', 'CUSTOM_A')).toBe('org-1:role:CUSTOM_A')
  })
})

describe('list changes', () => {
  it('replaces a role by code, or appends a new one', () => {
    const list = [summary('WORKER'), summary('CUSTOM_A')]

    expect(withRole(list, summary('CUSTOM_A', { version: 2 })).map((role) => role.version)).toEqual([1, 2])
    expect(withRole(list, summary('CUSTOM_B')).map((role) => role.code)).toEqual(['WORKER', 'CUSTOM_A', 'CUSTOM_B'])
    expect(withoutRole(list, 'CUSTOM_A').map((role) => role.code)).toEqual(['WORKER'])
  })

  it('keeps only the summary fields of a role detail', () => {
    const detail: RoleDetail = {
      ...summary('CUSTOM_A'),
      permissions: [],
      defaults: null,
      formerMemberCount: 1,
      invitationCount: 2,
    }

    expect(summaryOf(detail)).toEqual(summary('CUSTOM_A'))
  })
})

describe('rolesChanged', () => {
  it("changes the company's remembered list and tells every listener which company changed", () => {
    writeSessionValue(rolesKey('org-1'), [summary('CUSTOM_A')])
    const heard: string[] = []
    const stop = onRolesChanged((organizationId) => heard.push(organizationId))

    rolesChanged('org-1', (roles) => withoutRole(roles, 'CUSTOM_A'))
    stop()
    rolesChanged('org-2')

    expect(readSessionValue(rolesKey('org-1'))).toEqual([])
    expect(heard).toEqual(['org-1'])
  })

  it('leaves a company with no remembered list without one', () => {
    rolesChanged('org-3', (roles) => withRole(roles, summary('CUSTOM_A')))

    expect(readSessionValue(rolesKey('org-3'))).toBeUndefined()
  })
})

describe('roleDeleted', () => {
  it("forgets the role's page and drops it from the remembered list, so going back cannot show it as live", () => {
    writeSessionValue(roleKey('org-1', 'CUSTOM_A'), { code: 'CUSTOM_A' })
    writeSessionValue(roleKey('org-1', 'CUSTOM_B'), { code: 'CUSTOM_B' })
    writeSessionValue(rolesKey('org-1'), [summary('CUSTOM_A'), summary('CUSTOM_B')])
    const heard: string[] = []
    const stop = onRolesChanged((organizationId) => heard.push(organizationId))

    roleDeleted('org-1', 'CUSTOM_A')
    stop()

    expect(hasSessionValue(roleKey('org-1', 'CUSTOM_A'))).toBe(false)
    expect(hasSessionValue(roleKey('org-1', 'CUSTOM_B'))).toBe(true)
    expect(readSessionValue<RoleSummary[]>(rolesKey('org-1'))?.map((role) => role.code)).toEqual(['CUSTOM_B'])
    expect(heard).toEqual(['org-1'])
  })
})

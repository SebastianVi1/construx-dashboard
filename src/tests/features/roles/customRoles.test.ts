import { describe, expect, it } from 'bun:test'
import {
  canCreateRole,
  canDeleteRole,
  canDuplicate,
  copyName,
  deletionCounts,
  detailsChanged,
  detailsOf,
  editDraft,
  replacementOptions,
  reportedReplacementCounts,
  roleDetailsErrors,
} from '../../../features/roles/customRoles'
import type { RoleKind, RoleSummary } from '../../../features/roles/rolesApi'
import { ApiError } from '../../../lib/http'

function role(code: string, kind: RoleKind, flags: Partial<RoleSummary> = {}): RoleSummary {
  return {
    id: `id-${code}`,
    code,
    kind,
    name: code,
    names: { en: code, es: code },
    description: null,
    system: kind !== 'CUSTOM',
    customized: false,
    memberCount: 0,
    pendingInvitationCount: 0,
    editable: false,
    assignable: false,
    version: 0,
    ...flags,
  }
}

const customRoles = (count: number) => Array.from({ length: count }, (_, index) => role(`CUSTOM_${index}`, 'CUSTOM'))

describe('canCreateRole', () => {
  const builtIns = [role('OWNER', 'OWNER'), role('WORKER', 'BUILT_IN')]

  it('offers "New role" to someone with MANAGE_ROLES while the company has fewer than 30 custom roles', () => {
    expect(canCreateRole([...builtIns, ...customRoles(29)], true)).toBe(true)
  })

  it('hides it at the limit of 30 custom roles, however many built-in roles there are', () => {
    expect(canCreateRole([...builtIns, ...customRoles(30)], true)).toBe(false)
  })

  it('hides it without MANAGE_ROLES (a MANAGE_MEMBERS-only reader)', () => {
    expect(canCreateRole(builtIns, false)).toBe(false)
  })
})

describe('canDuplicate', () => {
  it('allows a role the caller may edit or assign, both of which mean it fits within the caller', () => {
    expect(canDuplicate(role('WORKER', 'BUILT_IN', { editable: true }), 'ADMINISTRATOR')).toBe(true)
    expect(canDuplicate(role('WORKER', 'BUILT_IN', { assignable: true }), 'ADMINISTRATOR')).toBe(true)
  })

  it("allows the caller's own role, which is not editable but always fits", () => {
    expect(canDuplicate(role('ADMINISTRATOR', 'BUILT_IN'), 'ADMINISTRATOR')).toBe(true)
  })

  it('refuses a role holding permissions the caller lacks (an Administrator and Finance)', () => {
    expect(canDuplicate(role('FINANCE', 'BUILT_IN'), 'ADMINISTRATOR')).toBe(false)
  })

  it('refuses the Owner role to everyone but the Owner', () => {
    expect(canDuplicate(role('OWNER', 'OWNER'), 'ADMINISTRATOR')).toBe(false)
    expect(canDuplicate(role('OWNER', 'OWNER'), 'OWNER')).toBe(true)
  })

  it('lets the Owner duplicate any role', () => {
    expect(canDuplicate(role('FINANCE', 'BUILT_IN'), 'OWNER')).toBe(true)
  })

  it('refuses everything while the caller is unknown', () => {
    expect(canDuplicate(role('WORKER', 'BUILT_IN'), null)).toBe(false)
  })
})

describe('copyName', () => {
  it('adds the suffix after the name', () => {
    expect(copyName('Worker', '(copy)')).toBe('Worker (copy)')
    expect(copyName('Trabajador', '(copia)')).toBe('Trabajador (copia)')
  })

  it('shortens a long name so the copy still fits in 100 characters', () => {
    const name = copyName('x'.repeat(100), '(copy)')
    expect(name.length).toBe(100)
    expect(name.endsWith('x (copy)')).toBe(true)
  })
})

describe('roleDetailsErrors', () => {
  it('accepts a name of 1 to 100 characters and a description of up to 280', () => {
    expect(roleDetailsErrors({ name: ' Foreman with prices ', description: '' })).toEqual({})
    expect(roleDetailsErrors({ name: 'n'.repeat(100), description: 'd'.repeat(280) })).toEqual({})
  })

  it('needs a name that is not blank', () => {
    expect(roleDetailsErrors({ name: '   ', description: '' })).toEqual({ name: 'required' })
  })

  it('refuses a name over 100 characters and a description over 280, after trimming', () => {
    expect(roleDetailsErrors({ name: 'n'.repeat(101), description: ` ${'d'.repeat(280)} ` })).toEqual({ name: 'tooLong' })
    expect(roleDetailsErrors({ name: 'ok', description: 'd'.repeat(281) })).toEqual({ description: 'tooLong' })
  })
})

describe('replacementOptions', () => {
  it('offers only roles the caller may assign, never the role being deleted or the Owner role', () => {
    const roles = [
      role('OWNER', 'OWNER'),
      role('WORKER', 'BUILT_IN', { assignable: true }),
      role('FINANCE', 'BUILT_IN'),
      role('CUSTOM_A', 'CUSTOM', { assignable: true }),
      role('CUSTOM_B', 'CUSTOM', { assignable: true }),
    ]

    expect(replacementOptions(roles, 'CUSTOM_A').map((option) => option.code)).toEqual(['WORKER', 'CUSTOM_B'])
  })
})

describe('reportedReplacementCounts', () => {
  it('reads the member, former-member and invitation counts of ROLE_REPLACEMENT_REQUIRED', () => {
    const error = new ApiError(409, undefined, 'ROLE_REPLACEMENT_REQUIRED', {
      memberCount: 0,
      formerMemberCount: 1,
      pendingInvitationCount: 2,
      invitationCount: 3,
    })

    expect(reportedReplacementCounts(error)).toEqual({ memberCount: 0, formerMemberCount: 1, pendingInvitationCount: 2, invitationCount: 3 })
  })

  it('treats a missing or non-numeric count as unknown', () => {
    const error = new ApiError(409, undefined, 'ROLE_REPLACEMENT_REQUIRED', { memberCount: '3' })

    expect(reportedReplacementCounts(error)).toEqual({
      memberCount: null,
      formerMemberCount: null,
      pendingInvitationCount: null,
      invitationCount: null,
    })
  })

  it('is null for any other failure', () => {
    expect(reportedReplacementCounts(new ApiError(409, undefined, 'ROLE_CHANGED'))).toBeNull()
    expect(reportedReplacementCounts(new Error('offline'))).toBeNull()
  })
})

describe('deletionCounts', () => {
  const usage = (counts: Partial<Record<'memberCount' | 'formerMemberCount' | 'pendingInvitationCount' | 'invitationCount', number>>) => ({
    memberCount: 0,
    formerMemberCount: 0,
    pendingInvitationCount: 0,
    invitationCount: 0,
    ...counts,
  })

  it('shows every count from the role page before the first attempt', () => {
    expect(deletionCounts(usage({ memberCount: 3, formerMemberCount: 2, pendingInvitationCount: 1, invitationCount: 4 }), null)).toEqual({
      memberCount: 3,
      formerMemberCount: 2,
      pendingInvitationCount: 1,
      pastInvitationCount: 3,
      needsReplacement: true,
    })
  })

  it('needs a replacement for a role held only by former members or past invitations', () => {
    expect(deletionCounts(usage({ formerMemberCount: 1 }), null).needsReplacement).toBe(true)
    expect(deletionCounts(usage({ invitationCount: 1 }), null)).toMatchObject({ pastInvitationCount: 1, needsReplacement: true })
  })

  it('needs no replacement while nothing references the role', () => {
    expect(deletionCounts(usage({}), null).needsReplacement).toBe(false)
  })

  it("takes the server's counts once it asked for a replacement", () => {
    const counts = deletionCounts(usage({}), { memberCount: 0, formerMemberCount: 0, pendingInvitationCount: 0, invitationCount: 2 })

    expect(counts).toEqual({ memberCount: 0, formerMemberCount: 0, pendingInvitationCount: 0, pastInvitationCount: 2, needsReplacement: true })
  })

  it('needs a replacement once the server asked for one, even if it sent no counts', () => {
    const counts = deletionCounts(usage({ memberCount: 1 }), { memberCount: null, formerMemberCount: null, pendingInvitationCount: null, invitationCount: null })

    expect(counts).toEqual({ memberCount: 1, formerMemberCount: 0, pendingInvitationCount: 0, pastInvitationCount: 0, needsReplacement: true })
  })
})

describe('canDeleteRole', () => {
  const unused = { kind: 'CUSTOM' as const, editable: true, memberCount: 0, formerMemberCount: 0, invitationCount: 0 }

  it('offers an unused Custom role the caller may edit, even without MANAGE_MEMBERS', () => {
    expect(canDeleteRole(unused, false)).toBe(true)
  })

  it('needs MANAGE_MEMBERS for a role in use, since the replacement must be assignable', () => {
    for (const used of [{ memberCount: 1 }, { formerMemberCount: 1 }, { invitationCount: 1 }]) {
      expect(canDeleteRole({ ...unused, ...used }, false)).toBe(false)
      expect(canDeleteRole({ ...unused, ...used }, true)).toBe(true)
    }
  })

  it('never offers a Built-in role or one the caller cannot edit', () => {
    expect(canDeleteRole({ ...unused, kind: 'BUILT_IN' }, true)).toBe(false)
    expect(canDeleteRole({ ...unused, editable: false }, true)).toBe(false)
  })
})

describe('role details on the role page', () => {
  const custom = role('CUSTOM_A', 'CUSTOM', { name: 'Capataz', description: { en: 'Leads a crew', es: 'Leads a crew' } })
  const grants = [{ action: 'VIEW_PROJECT', scope: 'PROJECT' as const }]

  it('starts the fields from the stored name and description (empty when there is none)', () => {
    expect(detailsOf(custom)).toEqual({ name: 'Capataz', description: 'Leads a crew' })
    expect(detailsOf(role('CUSTOM_B', 'CUSTOM', { name: 'Bare' }))).toEqual({ name: 'Bare', description: '' })
  })

  it('counts only a real change, ignoring surrounding spaces', () => {
    expect(detailsChanged(custom, { name: ' Capataz ', description: 'Leads a crew ' })).toBe(false)
    expect(detailsChanged(custom, { name: 'Capataz mayor', description: 'Leads a crew' })).toBe(true)
    expect(detailsChanged(custom, { name: 'Capataz', description: '' })).toBe(true)
  })

  it('sends the edited name and description with the permissions of a Custom role', () => {
    expect(editDraft(custom, { name: 'Capataz mayor', description: '' }, grants)).toEqual({
      name: 'Capataz mayor',
      description: '',
      permissions: grants,
    })
  })

  it('sends only the permissions of a Built-in role (ROLE_NAME_FIXED otherwise)', () => {
    expect(editDraft(role('WORKER', 'BUILT_IN'), { name: 'Worker', description: '' }, grants)).toEqual({ permissions: grants })
  })
})

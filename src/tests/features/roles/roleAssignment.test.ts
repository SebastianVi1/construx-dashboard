import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../../lib/http'
import type { RoleSummary } from '../../../features/roles/rolesApi'
import {
  addPersonCandidates,
  assignErrorKind,
  roleChoice,
  roleTab,
  roleTabSearch,
} from '../../../features/roles/roleAssignment'

function role(code: string, kind: RoleSummary['kind'], assignable: boolean): RoleSummary {
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
    editable: assignable,
    assignable,
    version: 0,
  }
}

// What an Administrator gets from GET /roles: Finance holds MANAGE_BUDGET, which they don't (contract §9.5).
const roles = [
  role('OWNER', 'OWNER', false),
  role('ADMINISTRATOR', 'BUILT_IN', false),
  role('WORKER', 'BUILT_IN', true),
  role('FINANCE', 'BUILT_IN', false),
  role('RESIDENT', 'BUILT_IN', true),
  role('CUSTOM_FOREMAN00', 'CUSTOM', true),
]

function member(membershipId: string, roleCode: string) {
  return { membershipId, role: { code: roleCode, name: roleCode, names: { en: roleCode, es: roleCode } } }
}

const codes = (list: { code: string }[]) => list.map((item) => item.code)

describe('roleChoice: the role dropdown on a member row', () => {
  it('offers only the roles the server marks assignable, in list order, for a member it may move', () => {
    const choice = roleChoice(member('m-2', 'WORKER'), roles, 'm-1')

    expect(choice.lock).toBeNull()
    expect(codes(choice.options)).toEqual(['WORKER', 'RESIDENT', 'CUSTOM_FOREMAN00'])
  })

  it('is locked on the Owner, showing only their role', () => {
    const choice = roleChoice(member('m-0', 'OWNER'), roles, 'm-1')

    expect(choice.lock).toBe('owner')
    expect(codes(choice.options)).toEqual(['OWNER'])
  })

  it("is locked on the caller's own row, even when their role is assignable", () => {
    // Someone whose own role is Worker but who holds MANAGE_MEMBERS through it.
    const choice = roleChoice(member('m-1', 'WORKER'), roles, 'm-1')

    expect(choice.lock).toBe('self')
    expect(codes(choice.options)).toEqual(['WORKER'])
  })

  it('is locked when the member currently holds a role the caller cannot assign (Finance)', () => {
    const choice = roleChoice(member('m-3', 'FINANCE'), roles, 'm-1')

    expect(choice.lock).toBe('notAssignable')
    expect(codes(choice.options)).toEqual(['FINANCE'])
  })

  it('is locked while the roles have not loaded, and for a role missing from the list', () => {
    expect(roleChoice(member('m-2', 'WORKER'), undefined, 'm-1').lock).toBe('loading')
    const unknown = roleChoice(member('m-2', 'CUSTOM_GONE00000'), roles, 'm-1')
    expect(unknown.lock).toBe('notAssignable')
    expect(codes(unknown.options)).toEqual(['CUSTOM_GONE00000'])
  })
})

describe('addPersonCandidates: the "Add person" picker on a role\'s People tab', () => {
  const members = [
    member('m-0', 'OWNER'),
    member('m-1', 'ADMINISTRATOR'),
    member('m-2', 'WORKER'),
    member('m-3', 'FINANCE'),
    member('m-4', 'RESIDENT'),
    member('m-5', 'CUSTOM_FOREMAN00'),
  ]

  it('lists members whose current role is assignable, leaving out the caller and those already in the role', () => {
    const resident = roles[4]

    expect(addPersonCandidates(members, resident, roles, 'm-1').map((item) => item.membershipId)).toEqual([
      'm-2',
      'm-5',
    ])
  })

  it('is empty when the role itself is not assignable by the caller', () => {
    expect(addPersonCandidates(members, roles[3], roles, 'm-1')).toEqual([])
    expect(addPersonCandidates(members, roles[0], roles, 'm-1')).toEqual([])
  })
})

describe('assignErrorKind', () => {
  it('names the assignment rule the server refused (contract §5.8)', () => {
    expect(assignErrorKind(new ApiError(403, undefined, 'ROLE_OWN'))).toBe('roleOwn')
    expect(assignErrorKind(new ApiError(400, undefined, 'ROLE_OWNER_LOCKED'))).toBe('roleOwnerLocked')
    expect(assignErrorKind(new ApiError(403, undefined, 'ROLE_ABOVE_CALLER'))).toBe('roleAboveCaller')
  })

  it('falls back to the status, and to generic for codes that do not apply to an assignment', () => {
    expect(assignErrorKind(new ApiError(401))).toBe('session')
    expect(assignErrorKind(new ApiError(403, undefined, 'FORBIDDEN'))).toBe('forbidden')
    expect(assignErrorKind(new ApiError(404, undefined, 'NOT_FOUND'))).toBe('notFound')
    expect(assignErrorKind(new ApiError(409, undefined, 'ROLE_CHANGED'))).toBe('generic')
    expect(assignErrorKind(new Error('offline'))).toBe('generic')
  })
})

describe('roleTab', () => {
  it('opens Permissions unless People is asked for and allowed', () => {
    expect(roleTab(new URLSearchParams(''), true)).toBe('permissions')
    expect(roleTab(new URLSearchParams('tab=people'), true)).toBe('people')
    expect(roleTab(new URLSearchParams('tab=people'), false)).toBe('permissions')
    expect(roleTab(new URLSearchParams('tab=nonsense'), true)).toBe('permissions')
  })

  it('keeps other search params and drops the param for the default tab', () => {
    expect(roleTabSearch(new URLSearchParams('x=1'), 'people').toString()).toBe('x=1&tab=people')
    expect(roleTabSearch(new URLSearchParams('x=1&tab=people'), 'permissions').toString()).toBe('x=1')
  })
})

import type { RoleRef } from '../permissions/can'
import { roleErrorKind, type RoleSummary } from './rolesApi'

/**
 * Why a member's role dropdown is locked (roles contract §8.4): the Owner role
 * is never assigned away, nobody changes their own role, the member's current
 * role is above the caller (or not in the list), or the roles have not loaded.
 */
export type RoleChoiceLock = 'owner' | 'self' | 'notAssignable' | 'loading'

/** What a member's role dropdown offers; a locked one shows just the current role. */
export type RoleChoice = { options: RoleRef[]; lock: RoleChoiceLock | null }

type MemberRef = { membershipId: string; role: RoleRef }

/**
 * The role dropdown of one member row. Only the server's `assignable` roles are
 * offered (§3), so the list itself never tempts a `ROLE_ABOVE_CALLER`.
 */
export function roleChoice(member: MemberRef, roles: RoleSummary[] | undefined, myMembershipId: string | null): RoleChoice {
  const current = roles?.find((role) => role.code === member.role.code)
  const locked = (lock: RoleChoiceLock): RoleChoice => ({ options: [current ?? member.role], lock })
  if (member.role.code === 'OWNER' || current?.kind === 'OWNER') return locked('owner')
  if (member.membershipId === myMembershipId) return locked('self')
  if (!roles) return locked('loading')
  if (!current?.assignable) return locked('notAssignable')
  return { options: roles.filter((role) => role.assignable), lock: null }
}

/**
 * Who "Add person" on a role's People tab may move into it: members whose
 * current role and this role are both assignable by the caller, other than the
 * caller and those already holding it (§8.3).
 */
export function addPersonCandidates<T extends MemberRef>(
  members: T[],
  role: RoleSummary,
  roles: RoleSummary[],
  myMembershipId: string | null,
): T[] {
  if (!role.assignable) return []
  const assignable = new Set(roles.filter((item) => item.assignable).map((item) => item.code))
  return members.filter(
    (member) =>
      member.membershipId !== myMembershipId && member.role.code !== role.code && assignable.has(member.role.code),
  )
}

const assignErrorKinds = ['roleOwn', 'roleOwnerLocked', 'roleAboveCaller', 'session', 'forbidden', 'notFound'] as const

export type AssignErrorKind = (typeof assignErrorKinds)[number] | 'generic'

/** Message kind for a failed role assignment (§5.8): the rule the server names, else the status. */
export function assignErrorKind(error: unknown): AssignErrorKind {
  const kind = roleErrorKind(error)
  return (assignErrorKinds as readonly string[]).includes(kind) ? (kind as AssignErrorKind) : 'generic'
}

/** The tabs of a role page; People needs `MANAGE_MEMBERS` (§8.3). */
export type RoleTab = 'permissions' | 'people'

/** The tab in the URL (`?tab=people`), falling back to Permissions when People is not allowed. */
export function roleTab(params: URLSearchParams, canSeePeople: boolean): RoleTab {
  return params.get('tab') === 'people' && canSeePeople ? 'people' : 'permissions'
}

/** Search params for a tab; Permissions is the default, so it needs no param. */
export function roleTabSearch(params: URLSearchParams, tab: RoleTab): URLSearchParams {
  const next = new URLSearchParams(params)
  if (tab === 'permissions') next.delete('tab')
  else next.set('tab', tab)
  return next
}

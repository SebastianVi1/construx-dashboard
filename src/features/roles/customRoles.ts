import { TEXT_LIMITS } from '../../components/form/limits'
import { ApiError } from '../../lib/http'
import type { Grant, RoleDetail, RoleDraft, RoleSummary } from './rolesApi'

/**
 * Pure rules of creating, duplicating, renaming and deleting Custom roles
 * (roles contract §5.3, §5.4, §5.6, §8.2–8.3). The server checks every write;
 * these only decide what the dashboard offers.
 */

/** Most Custom roles a company may have (§5.3, `ROLE_LIMIT_REACHED`). */
export const CUSTOM_ROLE_LIMIT = 30

const OWNER_CODE = 'OWNER'

/** "New role" shows with MANAGE_ROLES while the company has fewer than 30 Custom roles. */
export function canCreateRole(roles: RoleSummary[], canManageRoles: boolean): boolean {
  return canManageRoles && roles.filter((role) => role.kind === 'CUSTOM').length < CUSTOM_ROLE_LIMIT
}

/**
 * Whether `role`'s permissions fit within the caller, so a copy of it would be
 * accepted (§3). The list carries no permissions, so this reads the server's
 * own answers: `editable` and `assignable` both imply the role fits, the
 * caller's own role always fits, and the Owner fits everything. With
 * MANAGE_ROLES (needed to duplicate at all) that is exact.
 */
export function canDuplicate(role: Pick<RoleSummary, 'code' | 'editable' | 'assignable'>, myRoleCode: string | null): boolean {
  if (myRoleCode === null) return false
  return myRoleCode === OWNER_CODE || role.code === myRoleCode || role.editable || role.assignable
}

/** "<name> (copy)", with the name shortened when the copy would pass 100 characters. */
export function copyName(name: string, suffix: string): string {
  const room = TEXT_LIMITS.roleName - suffix.length - 1
  return `${name.trim().slice(0, room).trimEnd()} ${suffix}`
}

export type RoleDetails = { name: string; description: string }

export type RoleDetailsErrors = { name?: 'required' | 'tooLong'; description?: 'tooLong' }

/** What is wrong with a Custom role's name and description, after trimming; `{}` when they are fine. */
export function roleDetailsErrors({ name, description }: RoleDetails): RoleDetailsErrors {
  const errors: RoleDetailsErrors = {}
  const trimmed = name.trim()
  if (trimmed.length === 0) errors.name = 'required'
  else if (trimmed.length > TEXT_LIMITS.roleName) errors.name = 'tooLong'
  if (description.trim().length > TEXT_LIMITS.roleDescription) errors.description = 'tooLong'
  return errors
}

/** A Custom role's stored name and description as field values; both languages carry the same text (§5.1). */
export function detailsOf(role: Pick<RoleSummary, 'name' | 'description'>): RoleDetails {
  return { name: role.name, description: role.description?.en ?? '' }
}

/** Whether the fields differ from what is stored, ignoring surrounding spaces. */
export function detailsChanged(role: Pick<RoleSummary, 'name' | 'description'>, details: RoleDetails): boolean {
  const stored = detailsOf(role)
  return details.name.trim() !== stored.name.trim() || details.description.trim() !== stored.description.trim()
}

/**
 * The body of a save from the role page (§5.4): a Custom role sends its name
 * and description with the permissions; a Built-in role sends only the
 * permissions, because a name would be `ROLE_NAME_FIXED`.
 */
export function editDraft(role: Pick<RoleSummary, 'kind'>, details: RoleDetails, permissions: Grant[]): RoleDraft {
  if (role.kind !== 'CUSTOM') return { permissions }
  return { name: details.name, description: details.description, permissions }
}

/** Roles a deleted role's members and invitations may move to: assignable by the caller, not itself, not Owner. */
export function replacementOptions(roles: RoleSummary[], deletingCode: string): RoleSummary[] {
  return roles.filter((role) => role.assignable && role.code !== deletingCode && role.kind !== 'OWNER')
}

/** Counts the server sends with `ROLE_REPLACEMENT_REQUIRED` (§5.6); a count it left out is null. */
export type ReplacementCounts = {
  memberCount: number | null
  formerMemberCount: number | null
  pendingInvitationCount: number | null
  /** Invitations in any status (pending, accepted or revoked). */
  invitationCount: number | null
}

/** The counts of a `ROLE_REPLACEMENT_REQUIRED` refusal; null for any other failure. */
export function reportedReplacementCounts(error: unknown): ReplacementCounts | null {
  if (!(error instanceof ApiError) || error.code !== 'ROLE_REPLACEMENT_REQUIRED') return null
  const count = (name: keyof ReplacementCounts) => error.problemNumber(name) ?? null
  return {
    memberCount: count('memberCount'),
    formerMemberCount: count('formerMemberCount'),
    pendingInvitationCount: count('pendingInvitationCount'),
    invitationCount: count('invitationCount'),
  }
}

/** What references a role: the role page's counts (§5.2). */
export type RoleUsage = Pick<RoleDetail, 'memberCount' | 'formerMemberCount' | 'pendingInvitationCount' | 'invitationCount'>

export type DeletionCounts = {
  memberCount: number
  formerMemberCount: number
  pendingInvitationCount: number
  /** Accepted or revoked invitations: they still reference the role and move with it. */
  pastInvitationCount: number
  needsReplacement: boolean
}

/**
 * What the delete dialog states and asks for, before the first attempt: the
 * role page's counts. Once the server asked for a replacement its counts win
 * and a replacement is required whatever they say.
 */
export function deletionCounts(role: RoleUsage, reported: ReplacementCounts | null): DeletionCounts {
  const memberCount = reported?.memberCount ?? role.memberCount
  const formerMemberCount = reported?.formerMemberCount ?? role.formerMemberCount
  const pendingInvitationCount = reported?.pendingInvitationCount ?? role.pendingInvitationCount
  const invitationCount = reported?.invitationCount ?? role.invitationCount
  return {
    memberCount,
    formerMemberCount,
    pendingInvitationCount,
    pastInvitationCount: Math.max(0, invitationCount - pendingInvitationCount),
    needsReplacement: reported !== null || memberCount > 0 || formerMemberCount > 0 || invitationCount > 0,
  }
}

/**
 * Whether the role page offers "Delete role": a Custom role the caller may
 * edit (§3, §5.6). A role anything still references needs a replacement the
 * caller may assign, so that also needs `MANAGE_MEMBERS`.
 */
export function canDeleteRole(
  role: Pick<RoleDetail, 'kind' | 'editable' | 'memberCount' | 'formerMemberCount' | 'invitationCount'>,
  canManageMembers: boolean,
): boolean {
  if (role.kind !== 'CUSTOM' || !role.editable) return false
  const inUse = role.memberCount > 0 || role.formerMemberCount > 0 || role.invitationCount > 0
  return canManageMembers || !inUse
}

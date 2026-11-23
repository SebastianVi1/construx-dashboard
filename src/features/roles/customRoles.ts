import { ApiError } from '../../lib/http'
import type { Grant, RoleDraft, RoleSummary } from './rolesApi'

/**
 * Pure rules of creating, duplicating, renaming and deleting Custom roles
 * (roles contract §5.3, §5.4, §5.6, §8.2–8.3). The server checks every write;
 * these only decide what the dashboard offers.
 */

/** Most Custom roles a company may have (§5.3, `ROLE_LIMIT_REACHED`). */
export const CUSTOM_ROLE_LIMIT = 30

/** Name and description lengths a Custom role allows (§5.12 `ROLE_NAME_INVALID`). */
export const ROLE_NAME_MAX = 100
export const ROLE_DESCRIPTION_MAX = 280

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
  const room = ROLE_NAME_MAX - suffix.length - 1
  return `${name.trim().slice(0, room).trimEnd()} ${suffix}`
}

export type RoleDetails = { name: string; description: string }

export type RoleDetailsErrors = { name?: 'required' | 'tooLong'; description?: 'tooLong' }

/** What is wrong with a Custom role's name and description, after trimming; `{}` when they are fine. */
export function roleDetailsErrors({ name, description }: RoleDetails): RoleDetailsErrors {
  const errors: RoleDetailsErrors = {}
  const trimmed = name.trim()
  if (trimmed.length === 0) errors.name = 'required'
  else if (trimmed.length > ROLE_NAME_MAX) errors.name = 'tooLong'
  if (description.trim().length > ROLE_DESCRIPTION_MAX) errors.description = 'tooLong'
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
}

function count(error: ApiError, name: string): number | null {
  const value = error.problem[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** The counts of a `ROLE_REPLACEMENT_REQUIRED` refusal; null for any other failure. */
export function reportedReplacementCounts(error: unknown): ReplacementCounts | null {
  if (!(error instanceof ApiError) || error.code !== 'ROLE_REPLACEMENT_REQUIRED') return null
  return {
    memberCount: count(error, 'memberCount'),
    formerMemberCount: count(error, 'formerMemberCount'),
    pendingInvitationCount: count(error, 'pendingInvitationCount'),
  }
}

export type DeletionCounts = {
  memberCount: number
  /** Members who left still reference the role; only the server knows how many. */
  formerMemberCount: number | null
  pendingInvitationCount: number
  needsReplacement: boolean
}

/**
 * What the delete dialog states and asks for. Before the first attempt only
 * the role's own counts are known; once the server asked for a replacement its
 * counts win and a replacement is required whatever they say.
 */
export function deletionCounts(
  role: Pick<RoleSummary, 'memberCount' | 'pendingInvitationCount'>,
  reported: ReplacementCounts | null,
): DeletionCounts {
  const memberCount = reported?.memberCount ?? role.memberCount
  const pendingInvitationCount = reported?.pendingInvitationCount ?? role.pendingInvitationCount
  const formerMemberCount = reported?.formerMemberCount ?? null
  return {
    memberCount,
    formerMemberCount,
    pendingInvitationCount,
    needsReplacement: reported !== null || memberCount > 0 || pendingInvitationCount > 0 || (formerMemberCount ?? 0) > 0,
  }
}

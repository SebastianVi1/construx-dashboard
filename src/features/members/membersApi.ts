import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'
import { ApiError, deleteJson, getJson, sendJson } from '../../lib/http'
import { roleSchema } from '../permissions/can'
import { personSchema } from '../people/personSchema'
import { organizationPath } from '../../lib/apiPaths'

export const memberSchema = personSchema.extend({
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string(),
  role: roleSchema,
  status: z.string(),
})

export type Member = z.infer<typeof memberSchema>

export const invitationSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  role: roleSchema,
  projectId: z.string().nullable(),
  status: z.string(),
  expiresAt: z.string(),
})

export type Invitation = z.infer<typeof invitationSchema>

/** Invite form values; an empty `projectId` means "no site". */
export type InvitationDraft = { email: string; roleCode: string; projectId: string }

/** Membership statuses `GET /members` can list; the server's default is `ACTIVE`. */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT'

/** Optional `GET /members` filters: a status other than active, and one role's holders (roles contract §5.7). */
export type MemberFilter = { status?: MemberStatus; role?: string }

/** Members with emails (needs `MANAGE_MEMBERS`): active ones unless a filter says otherwise. */
export function listMembers(organizationId: string, filter: MemberFilter = {}): Promise<Member[]> {
  const query = new URLSearchParams()
  if (filter.status) query.set('status', filter.status)
  if (filter.role) query.set('role', filter.role)
  const search = query.size > 0 ? `?${query}` : ''
  return getJson(`${organizationPath(organizationId)}/members${search}`, z.array(memberSchema))
}

/**
 * Moves a member to another role (roles contract §5.8). The server refuses your
 * own row (`ROLE_OWN`), the Owner role either way (`ROLE_OWNER_LOCKED`) and a
 * current or target role above yours (`ROLE_ABOVE_CALLER`).
 */
export function changeMemberRole(organizationId: string, membershipId: string, roleCode: string): Promise<Member> {
  return sendJson(
    'patch',
    `${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}`,
    { roleCode },
    200,
    memberSchema,
  )
}

/** Roles an invitation may grant: those the server marks assignable for the caller (never Owner; roles contract §3). */
export function invitableRoles<T extends { assignable: boolean }>(roles: T[]): T[] {
  return roles.filter((role) => role.assignable)
}

export function listInvitations(organizationId: string): Promise<Invitation[]> {
  return getJson(`${organizationPath(organizationId)}/invitations?status=PENDING`, z.array(invitationSchema))
}

/**
 * Invite by email. Inviting an address that already has a pending invitation
 * replaces it, which is also how an invitation is resent.
 */
export function createInvitation(organizationId: string, draft: InvitationDraft): Promise<Invitation> {
  const body: Record<string, string> = { email: draft.email.trim(), roleCode: draft.roleCode }
  if (draft.projectId) body.projectId = draft.projectId
  return sendJson('post', `${organizationPath(organizationId)}/invitations`, body, 201, invitationSchema)
}

export function revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
  return deleteJson(`${organizationPath(organizationId)}/invitations/${encodeURIComponent(invitationId)}`)
}

export function suspendMember(organizationId: string, membershipId: string): Promise<Member> {
  return sendJson(
    'patch',
    `${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}/status`,
    { status: 'SUSPENDED' },
    200,
    memberSchema,
  )
}

export function reactivateMember(organizationId: string, membershipId: string): Promise<Member> {
  return sendJson(
    'patch',
    `${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}/status`,
    { status: 'ACTIVE' },
    200,
    memberSchema,
  )
}

export function removeMember(organizationId: string, membershipId: string): Promise<void> {
  return deleteJson(`${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}`)
}

export type MemberActionErrorKind = 'conflict' | 'session' | 'forbidden' | 'notFound' | 'generic'

export function memberActionErrorKind(error: unknown): MemberActionErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 409) return 'conflict'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

export type InviteValidationMessages = { emailRequired: string; emailInvalid: string; roleRequired: string }

export function makeInviteSchema(messages: InviteValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages.emailRequired)
      .max(TEXT_LIMITS.email, messages.emailInvalid)
      .email(messages.emailInvalid),
    roleCode: z.string().min(1, messages.roleRequired),
    projectId: z.string(),
  })
}

export type InviteErrorKind =
  | 'alreadyMember'
  | 'invalidEmail'
  | 'invalid'
  | 'roleAboveCaller'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

export function inviteErrorKind(error: unknown): InviteErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'ROLE_ABOVE_CALLER') return 'roleAboveCaller'
  if (error.status === 409) return 'alreadyMember'
  if (error.status === 400) return error.code === 'VALIDATION_FAILED' ? 'invalidEmail' : 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

export type RevokeErrorKind = 'notPending' | 'session' | 'forbidden' | 'notFound' | 'generic'

export function revokeErrorKind(error: unknown): RevokeErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 409) return 'notPending'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

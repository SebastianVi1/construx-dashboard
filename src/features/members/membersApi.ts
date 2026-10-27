import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { roleSchema } from '../permissions/can'
import { organizationPath } from '../permissions/permissionsApi'

export const memberSchema = z.object({
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string(),
  fullName: z.string().nullable(),
  role: roleSchema,
  status: z.string(),
})

export type Member = z.infer<typeof memberSchema>

export const organizationRoleSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  system: z.boolean(),
})

export type OrganizationRole = z.infer<typeof organizationRoleSchema>

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

/** Active members, with emails (needs `MANAGE_MEMBERS`). */
export function listMembers(organizationId: string): Promise<Member[]> {
  return getJson(`${organizationPath(organizationId)}/members`, z.array(memberSchema))
}

export function listRoles(organizationId: string): Promise<OrganizationRole[]> {
  return getJson(`${organizationPath(organizationId)}/roles`, z.array(organizationRoleSchema))
}

/** Roles an invitation may grant: every role except OWNER (there is one owner, the creator). */
export function invitableRoles<T extends { code: string }>(roles: T[]): T[] {
  return roles.filter((role) => role.code !== 'OWNER')
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

export type InviteValidationMessages = { emailRequired: string; emailInvalid: string; roleRequired: string }

export function makeInviteSchema(messages: InviteValidationMessages) {
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
    roleCode: z.string().min(1, messages.roleRequired),
    projectId: z.string(),
  })
}

export type InviteErrorKind = 'alreadyMember' | 'invalidEmail' | 'invalid' | 'session' | 'forbidden' | 'notFound' | 'generic'

export function inviteErrorKind(error: unknown): InviteErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 409) return 'alreadyMember'
  if (error.status === 400) return error.code === 'VALIDATION_FAILED' ? 'invalidEmail' : 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

export type RevokeErrorKind = 'notPending' | 'session' | 'forbidden' | 'notFound' | 'generic'

export function revokeErrorKind(error: unknown): RevokeErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 409) return 'notPending'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

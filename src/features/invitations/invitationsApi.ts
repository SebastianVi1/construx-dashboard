import { z } from 'zod'
import { AuthApiError, sendJson } from '../auth/authApi'
import { roleSchema } from '../permissions/can'

/** `POST /api/invitations/accept` answer: the organization joined and, if named, its site. */
export const acceptedInvitationSchema = z.object({
  organization: z.object({ id: z.string().min(1), name: z.string() }),
  membershipId: z.string().min(1),
  role: roleSchema,
  projectId: z.string().nullable(),
})

export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>

/** Join the organization of an emailed invitation as the signed-in account. */
export function acceptInvitation(token: string): Promise<AcceptedInvitation> {
  return sendJson('post', '/invitations/accept', { token }, 200, acceptedInvitationSchema)
}

/** Where to go after joining: the invited site, else the workspace home. */
export function joinedPath(accepted: AcceptedInvitation): string {
  return accepted.projectId ? `/sites/${encodeURIComponent(accepted.projectId)}` : '/'
}

export type AcceptErrorKind = 'notForYou' | 'unavailable' | 'rateLimited' | 'session' | 'generic'

/**
 * 404 (and a rejected token shape) means the invitation does not exist or is
 * for another email; 409 means used, expired, revoked, or already a member.
 */
export function acceptErrorKind(error: unknown): AcceptErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 404 || error.status === 400) return 'notForYou'
  if (error.status === 409) return 'unavailable'
  if (error.status === 429) return 'rateLimited'
  if (error.status === 401) return 'session'
  return 'generic'
}

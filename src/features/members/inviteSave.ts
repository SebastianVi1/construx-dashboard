import { markGuideStep } from '../guide'
import { createInvitation, type Invitation, type InvitationDraft } from './membersApi'

/**
 * Invite someone to the Company. An invitation that was sent ticks the
 * guide's "Invite a member" step; a failed one doesn't.
 */
export async function sendInvitation(
  organizationId: string,
  draft: InvitationDraft,
  create: typeof createInvitation = createInvitation,
): Promise<Invitation> {
  const invitation = await create(organizationId, draft)
  markGuideStep('invite-member', organizationId)
  return invitation
}

import { describe, expect, it } from 'bun:test'
import { sendInvitation } from '../../../features/members/inviteSave'
import type { Invitation, InvitationDraft } from '../../../features/members/membersApi'
import { recordGuideMarks } from '../../support/guideMarks'

const marks = recordGuideMarks()
const draft: InvitationDraft = { email: 'ana@example.com', roleCode: 'MEMBER', projectId: '' }
const invitation = { id: 'inv-1', email: 'ana@example.com' } as Invitation

describe('sendInvitation', () => {
  it('sends the invitation and ticks "Invite a member" in its Company', async () => {
    const sent: unknown[] = []
    const result = await sendInvitation('org-1', draft, async (...args) => {
      sent.push(args)
      return invitation
    })
    expect(result).toBe(invitation)
    expect(sent).toEqual([['org-1', draft]])
    expect(marks).toEqual([{ stepId: 'invite-member', organizationId: 'org-1' }])
  })

  it('does not tick the step when the invitation fails, and passes the error on', async () => {
    const failure = new Error('409')
    await expect(
      sendInvitation('org-1', draft, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})

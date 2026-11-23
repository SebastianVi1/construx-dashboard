import { useRef, useState } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import { changeMemberRole, type Member } from '../members/membersApi'
import { roleLabel } from '../permissions'
import { assignErrorKind } from './roleAssignment'
import { rolesChanged } from './rolesCache'

export type MoveFeedback = { tone: 'success' | 'error'; text: string }

type Options = {
  /** The server's answer: the member with their new role. */
  onMoved: (moved: Member) => void
  /** "Moved X to Y", or why the move failed. */
  onFeedback: (feedback: MoveFeedback | null) => void
}

/**
 * Moving a member to another role (roles contract §5.8), shared by the Members
 * page and a role's People tab: one move at a time, then the roles lists
 * refetch (§8.5) and the result is reported.
 */
export function useRoleMove(organizationId: string, { onMoved, onFeedback }: Options) {
  const { messages: m, locale } = useLocale()
  const running = useRef(false)
  const [pending, setPending] = useState<{ membershipId: string; roleCode: string } | null>(null)

  async function move(member: Member, roleCode: string) {
    if (running.current) return
    running.current = true
    setPending({ membershipId: member.membershipId, roleCode })
    onFeedback(null)
    try {
      const moved = await changeMemberRole(organizationId, member.membershipId, roleCode)
      onMoved(moved)
      rolesChanged(organizationId)
      onFeedback({
        tone: 'success',
        text: formatMessage(m.roles.people.moved, { name: moved.fullName || moved.email, role: roleLabel(moved.role, locale) }),
      })
    } catch (error) {
      onFeedback({ tone: 'error', text: m.roles.assignError[assignErrorKind(error)] })
    } finally {
      running.current = false
      setPending(null)
    }
  }

  return { move, pending }
}

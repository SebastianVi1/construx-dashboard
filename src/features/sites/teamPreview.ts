import type { RoleRef } from '../permissions/can'

/** Site leadership first, then the rest of the crew; unknown custom roles go last. */
const roleOrder = ['SITE_MANAGER', 'SUPERINTENDENT', 'RESIDENT', 'OWNER', 'ADMINISTRATOR', 'FINANCE', 'MEMBER', 'WORKER']

type Person = { accessId: string; membershipId: string; fullName: string | null; role: RoleRef }

export type TeamPreview<P extends Person> = {
  shown: P[]
  hidden: number
  roles: { role: RoleRef; count: number }[]
}

function rank(role: RoleRef): number {
  const index = roleOrder.indexOf(role.code)
  return index === -1 ? roleOrder.length : index
}

/**
 * The people the overview shows: the caller first, then by site role and name,
 * plus a head count per role in the same order.
 */
export function teamPreview<P extends Person>(people: P[], myMembershipId: string | null, limit: number): TeamPreview<P> {
  const sorted = [...people].sort(
    (a, b) =>
      Number(b.membershipId === myMembershipId) - Number(a.membershipId === myMembershipId) ||
      rank(a.role) - rank(b.role) ||
      (a.fullName ?? '￿').localeCompare(b.fullName ?? '￿'),
  )
  const counts = new Map<string, { role: RoleRef; count: number }>()
  for (const person of people) {
    const entry = counts.get(person.role.code)
    if (entry) entry.count += 1
    else counts.set(person.role.code, { role: person.role, count: 1 })
  }
  const roles = [...counts.values()].sort((a, b) => rank(a.role) - rank(b.role) || b.count - a.count)
  return { shown: sorted.slice(0, limit), hidden: Math.max(0, sorted.length - limit), roles }
}

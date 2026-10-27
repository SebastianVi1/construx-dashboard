export type SiteProgress = { done: number; total: number; percent: number }

/** Task progress of a site, or null when the caller cannot see its tasks. */
export function siteProgress(site: { activityCount: number | null; doneCount: number | null }): SiteProgress | null {
  if (site.activityCount === null || site.doneCount === null) return null
  const total = site.activityCount
  const done = site.doneCount
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Members who can still be added to a site: everyone not already on it. */
export function assignableMembers<T extends { membershipId: string }>(
  members: T[],
  access: { membershipId: string }[],
): T[] {
  const onSite = new Set(access.map((person) => person.membershipId))
  return members.filter((member) => !onSite.has(member.membershipId))
}

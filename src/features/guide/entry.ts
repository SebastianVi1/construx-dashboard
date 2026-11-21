/** What the Guide entry (sidebar, or header on phones) does for this member. */
export type GuideEntry = { kind: 'panel' } | { kind: 'landing'; href: string } | null

/**
 * A member with steps opens the checklist. A member with none (a Worker) gets
 * a link to the landing guide's start chapter instead, or no entry at all when
 * no landing URL is configured. Nothing shows before permissions load.
 */
export function guideEntry(input: { permissionsReady: boolean; hasSteps: boolean; landingHref: string | null }): GuideEntry {
  if (!input.permissionsReady) return null
  if (input.hasSteps) return { kind: 'panel' }
  return input.landingHref === null ? null : { kind: 'landing', href: input.landingHref }
}

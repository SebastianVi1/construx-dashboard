import { formatMessage } from '../../i18n'
import type { GuideCount } from './selection'

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

/** Progress beside a Guide entry: `short` to show ("2/5"), `label` to read out. */
export type EntryProgress = { short: string; label: string }

/** The entry's progress while steps are open; none once the guide is complete. */
export function entryProgress(
  count: Pick<GuideCount, 'done' | 'total' | 'complete'>,
  t: { count: string; progress: string },
): EntryProgress | null {
  if (count.complete) return null
  const values = { done: count.done, total: count.total }
  return { short: formatMessage(t.count, values), label: formatMessage(t.progress, values) }
}

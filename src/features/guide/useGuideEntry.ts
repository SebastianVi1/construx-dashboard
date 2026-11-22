import { getLandingUrl } from '../../config/env'
import { useLocale } from '../../i18n'
import { usePermissions } from '../permissions'
import { entryProgress, guideEntry, type EntryProgress } from './entry'
import { useGuide } from './guide-context'
import { landingGuideHref } from './landing'

/** A Guide entry ready to render: a link to the landing guide, a button that opens the checklist, or nothing. */
export type GuideEntryView =
  | { kind: 'landing'; href: string }
  | { kind: 'panel'; isOpen: boolean; open: () => void; progress: EntryProgress | null }
  | null

/**
 * What this member's Guide entry does and shows. The sidebar entry and the
 * phone header entry both render from it, so they never disagree.
 */
export function useGuideEntry(): GuideEntryView {
  const { status } = usePermissions()
  const { sections, count, isOpen, open } = useGuide()
  const { locale, messages: m } = useLocale()
  const entry = guideEntry({
    permissionsReady: status === 'ready',
    hasSteps: sections.length > 0,
    landingHref: landingGuideHref(getLandingUrl(), locale, 'start'),
  })
  if (entry === null || entry.kind === 'landing') return entry
  return { kind: 'panel', isOpen, open, progress: entryProgress(count, m.guide) }
}

import { getLandingUrl } from '../../config/env'
import { useLocale } from '../../i18n'
import { usePermissions } from '../permissions'
import { guideEntry, type GuideEntry } from './entry'
import { useGuide } from './guide-context'
import { landingGuideHref } from './landing'

/** What this member's Guide entry does: open the checklist, link to the landing guide, or nothing. */
export function useGuideEntry(): GuideEntry {
  const { status } = usePermissions()
  const { sections } = useGuide()
  const { locale } = useLocale()
  return guideEntry({
    permissionsReady: status === 'ready',
    hasSteps: sections.length > 0,
    landingHref: landingGuideHref(getLandingUrl(), locale, 'start'),
  })
}

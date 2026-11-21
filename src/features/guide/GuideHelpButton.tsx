import { useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import { stepsOnPage } from './guidePaths'
import './guide-actions.css'

/**
 * The page's "?" in its header: replays the tours of the member's steps on
 * this page, in checklist order (on phones it opens the checklist). Renders
 * nothing when the member has no step here. `page` is an id from `guidePages`.
 */
export function GuideHelpButton({ page }: { page: string }) {
  const { sections, replayPage } = useGuide()
  const { messages: m } = useLocale()

  if (stepsOnPage(sections, page).length === 0) return null

  return (
    <button type="button" className="guide-help" aria-label={m.guide.help} title={m.guide.help} onClick={() => replayPage(page)}>
      <span aria-hidden="true">?</span>
    </button>
  )
}

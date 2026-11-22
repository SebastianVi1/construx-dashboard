import { useLocale } from '../../i18n'
import type { GuidePageId } from './catalog'
import { useGuide } from './guide-context'
import { stepsOnPage } from './guidePaths'
import './guide-actions.css'

/**
 * The page's "?" in its header: replays the tours of the member's steps on
 * this page, in checklist order (on phones it opens the checklist). Renders
 * nothing when the member has no step here. `page` is an id from `guidePages`.
 * `onReplay` runs first: a page whose targets sit behind one of its tabs
 * opens that tab there, and the tour waits for the targets to show.
 */
export function GuideHelpButton({ page, onReplay }: { page: GuidePageId; onReplay?: () => void }) {
  const { sections, replayPage } = useGuide()
  const { messages: m } = useLocale()

  if (stepsOnPage(sections, page).length === 0) return null

  return (
    <button
      type="button"
      className="guide-help"
      aria-label={m.guide.help}
      title={m.guide.help}
      onClick={() => {
        onReplay?.()
        replayPage(page)
      }}
    >
      <span aria-hidden="true">?</span>
    </button>
  )
}

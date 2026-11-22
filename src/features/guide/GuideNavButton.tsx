import { useLocale } from '../../i18n'
import { GuideEntryControl } from './GuideEntryControl'
import { GuideIcon, NewTabIcon } from './GuideIcon'
import { useGuideEntry } from './useGuideEntry'
import './guide.css'

/**
 * "Guide" entry of the workspace sidebar. Opens the checklist even when the
 * guide is hidden. A member with no steps (a Worker) gets a link to the
 * landing guide instead, or no entry when no landing URL is configured.
 */
export function GuideNavButton() {
  const entry = useGuideEntry()
  const { messages: m } = useLocale()

  if (entry === null) return null

  return (
    <GuideEntryControl entry={entry} className="workspace-nav__link guide-nav-button">
      <GuideIcon className="workspace-nav__icon" />
      <span className="workspace-nav__label">{m.guide.navEntry}</span>
      {entry.kind === 'landing' ? (
        <NewTabIcon className="guide-nav-button__new-tab" />
      ) : entry.progress ? (
        <span className="guide-nav-button__count">
          <span aria-hidden="true">{entry.progress.short}</span>
          <span className="visually-hidden">{entry.progress.label}</span>
        </span>
      ) : null}
    </GuideEntryControl>
  )
}

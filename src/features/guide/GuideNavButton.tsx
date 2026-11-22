import { useLocale } from '../../i18n'
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
  const t = m.guide

  if (entry === null) return null

  if (entry.kind === 'landing') {
    return (
      <a className="workspace-nav__link guide-nav-button" href={entry.href} target="_blank" rel="noopener noreferrer">
        <GuideIcon className="workspace-nav__icon" />
        <span className="workspace-nav__label">
          {t.navEntry}
          <span className="visually-hidden"> {t.landingEntryLabel}</span>
        </span>
        <NewTabIcon className="guide-nav-button__new-tab" />
      </a>
    )
  }

  return (
    <button
      type="button"
      className="workspace-nav__link guide-nav-button"
      aria-haspopup="dialog"
      aria-expanded={entry.isOpen}
      onClick={entry.open}
    >
      <GuideIcon className="workspace-nav__icon" />
      <span className="workspace-nav__label">{t.navEntry}</span>
      {entry.progress ? (
        <span className="guide-nav-button__count">
          <span aria-hidden="true">{entry.progress.short}</span>
          <span className="visually-hidden">{entry.progress.label}</span>
        </span>
      ) : null}
    </button>
  )
}

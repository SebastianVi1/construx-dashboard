import { formatMessage, useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import { GuideIcon, NewTabIcon } from './GuideIcon'
import { useGuideEntry } from './useGuideEntry'
import './guide.css'

/**
 * "Guide" entry of the workspace sidebar. Opens the checklist even when the
 * guide is hidden. A member with no steps (a Worker) gets a link to the
 * landing guide instead, or no entry when no landing URL is configured.
 */
export function GuideNavButton() {
  const { count, isOpen, open } = useGuide()
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
      aria-expanded={isOpen}
      onClick={open}
    >
      <GuideIcon className="workspace-nav__icon" />
      <span className="workspace-nav__label">{t.navEntry}</span>
      {count.complete ? null : (
        <span className="guide-nav-button__count">
          <span aria-hidden="true">{formatMessage(t.count, { done: count.done, total: count.total })}</span>
          <span className="visually-hidden">{formatMessage(t.progress, { done: count.done, total: count.total })}</span>
        </span>
      )}
    </button>
  )
}

import { formatMessage, useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import { GuideIcon } from './GuideIcon'
import './guide.css'

/**
 * "Guide" entry of the workspace sidebar. Opens the checklist even when the
 * guide is hidden; absent for members with no steps.
 */
export function GuideNavButton() {
  const { sections, count, isOpen, open } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide

  if (sections.length === 0) return null

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

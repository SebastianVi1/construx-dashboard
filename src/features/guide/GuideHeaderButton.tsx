import { createPortal } from 'react-dom'
import { formatMessage, useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import { GuideIcon } from './GuideIcon'
import { useGuideEntry } from './useGuideEntry'
import './guide.css'

/**
 * The Guide entry on phones, where the sidebar gives way to the bottom tab
 * bar: a compact button in the header, next to the account menu. The header
 * sits outside the per-Company providers, so it renders through a portal into
 * a slot the header leaves for it. CSS shows it only at phone width.
 */
export function GuideHeaderButton({ container }: { container: HTMLElement | null }) {
  const { count, isOpen, open } = useGuide()
  const entry = useGuideEntry()
  const { messages: m } = useLocale()
  const t = m.guide

  if (container === null || entry === null) return null

  const content = (
    <>
      <GuideIcon className="guide-header-button__icon" />
      <span className="guide-header-button__label">{t.navEntry}</span>
    </>
  )

  return createPortal(
    entry.kind === 'landing' ? (
      <a className="guide-header-button" href={entry.href} target="_blank" rel="noopener noreferrer">
        {content}
        <span className="visually-hidden"> {t.landingEntryLabel}</span>
      </a>
    ) : (
      <button
        type="button"
        className="guide-header-button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={open}
      >
        {content}
        {count.complete ? null : (
          <span className="visually-hidden">, {formatMessage(t.progress, { done: count.done, total: count.total })}</span>
        )}
      </button>
    ),
    container,
  )
}

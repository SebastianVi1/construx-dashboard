import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { GuideEntryControl } from './GuideEntryControl'
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
  const entry = useGuideEntry()
  const { messages: m } = useLocale()

  if (container === null || entry === null) return null

  return createPortal(
    <GuideEntryControl entry={entry} className="guide-header-button">
      <GuideIcon className="guide-header-button__icon" />
      <span className="guide-header-button__label">{m.guide.navEntry}</span>
      {entry.kind === 'panel' && entry.progress ? <span className="visually-hidden">, {entry.progress.label}</span> : null}
    </GuideEntryControl>,
    container,
  )
}

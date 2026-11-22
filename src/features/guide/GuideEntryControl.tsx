import type { ReactNode } from 'react'
import { useLocale } from '../../i18n'
import type { GuideEntryView } from './useGuideEntry'

type GuideEntryControlProps = {
  entry: NonNullable<GuideEntryView>
  className: string
  /** What the entry shows (icon, label, progress); the same for the link and the button. */
  children: ReactNode
}

/**
 * The element behind a Guide entry (sidebar or phone header): a link to the
 * landing guide that opens a new tab and says so to screen readers, or a
 * button that opens the checklist.
 */
export function GuideEntryControl({ entry, className, children }: GuideEntryControlProps) {
  const { messages: m } = useLocale()

  if (entry.kind === 'landing') {
    return (
      <a className={className} href={entry.href} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="visually-hidden"> {m.guide.landingEntryLabel}</span>
      </a>
    )
  }

  return (
    <button type="button" className={className} aria-haspopup="dialog" aria-expanded={entry.isOpen} onClick={entry.open}>
      {children}
    </button>
  )
}

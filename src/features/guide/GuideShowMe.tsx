import { formatMessage, useLocale } from '../../i18n'
import type { GuideStepEntry } from './catalog'
import { useGuide } from './guide-context'
import './guide-actions.css'

/** "Show me" under a checklist step. Offered on done steps too, so a tour can be replayed. */
export function GuideShowMe({ step }: { step: GuideStepEntry }) {
  const { showMe } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide

  return (
    <button
      type="button"
      className="guide-step__show"
      aria-label={formatMessage(t.showMeLabel, { step: t.steps[step.textKey].title })}
      onClick={() => showMe(step.id)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
      </svg>
      {t.showMe}
    </button>
  )
}

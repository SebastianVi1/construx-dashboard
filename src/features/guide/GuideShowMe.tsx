import { formatMessage, useLocale } from '../../i18n'
import type { GuideStepEntry } from './catalog'
import { useGuide } from './guide-context'
import './guide-actions.css'

/**
 * "Show me" under a checklist step, plus the hint left by the last attempt:
 * open a Site first, or the target never showed (then the step's text is
 * repeated here when the row no longer shows it). Offered on done steps too,
 * so a tour can be replayed.
 */
export function GuideShowMe({ step, done }: { step: GuideStepEntry; done: boolean }) {
  const { notice, showMe } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide
  const text = t.steps[step.textKey]
  const hint = notice?.stepId === step.id ? notice.kind : null

  return (
    <>
      {hint ? (
        <div className="guide-step__notice" role="status">
          <p>{hint === 'needsSite' ? t.needsSite : t.targetMissing}</p>
          {hint === 'targetMissing' && done ? <p>{text.body}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        className="guide-step__show"
        aria-label={formatMessage(t.showMeLabel, { step: text.title })}
        onClick={() => showMe(step.id)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </svg>
        {t.showMe}
      </button>
    </>
  )
}

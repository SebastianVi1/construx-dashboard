import { useEffect, useRef } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import type { GuideStepEntry } from './catalog'
import { useGuide } from './guide-context'
import './guide-actions.css'

/**
 * The hint left under a step by the last "Show me": open a Site first, the
 * page is open (phones, where it stands in for the spotlight), or the target
 * never showed. The step's text is repeated when the row no longer shows it
 * (done or skipped). Scrolls itself into view in the checklist.
 */
export function GuideStepNotice({ step, done }: { step: GuideStepEntry; done: boolean }) {
  const { notice } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide
  const ref = useRef<HTMLDivElement>(null)
  const kind = notice?.stepId === step.id ? notice.kind : null

  useEffect(() => {
    if (kind) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [kind])

  if (!kind) return null
  const lead = kind === 'needsSite' ? t.needsSite : kind === 'onPage' ? t.onPage : t.targetMissing

  return (
    <div ref={ref} className="guide-step__notice" role="status">
      <p>{lead}</p>
      {kind !== 'needsSite' && done ? <p>{t.steps[step.textKey].body}</p> : null}
    </div>
  )
}

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

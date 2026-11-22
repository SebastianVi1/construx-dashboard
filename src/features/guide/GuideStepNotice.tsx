import { useEffect, useRef } from 'react'
import { useLocale } from '../../i18n'
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

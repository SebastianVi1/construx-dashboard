import { useEffect, useEffectEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from '../../components/icons'
import { formatMessage, useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import { GuideIcon } from './GuideIcon'
import './guide.css'

/** How long "You're set up" stays before the launcher goes away. */
const COMPLETION_MS = 6000

/**
 * Bottom-right button that opens the checklist and shows progress ("0/1").
 * When the last step is done it shows "You're set up" once, then hides.
 * Rendered through a portal so it floats above every screen.
 */
export function GuideLauncher() {
  const { launcherVisible, justCompleted, count, open, acknowledgeCompletion } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide
  const celebrating = launcherVisible && justCompleted
  const acknowledge = useEffectEvent(() => acknowledgeCompletion())

  useEffect(() => {
    if (!celebrating) return
    const timer = setTimeout(acknowledge, COMPLETION_MS)
    return () => clearTimeout(timer)
  }, [celebrating])

  if (!launcherVisible) return null

  const counter = formatMessage(t.count, { done: count.done, total: count.total })

  return createPortal(
    <div className="guide-launcher" data-state={celebrating ? 'complete' : 'open'}>
      <button
        type="button"
        className="guide-launcher__button"
        aria-haspopup="dialog"
        onClick={() => {
          acknowledgeCompletion()
          open()
        }}
      >
        {celebrating ? <CheckIcon className="guide-launcher__icon" /> : <GuideIcon className="guide-launcher__icon" />}
        <span className="guide-launcher__label" aria-live="polite">
          {celebrating ? t.complete.title : t.launcher}
        </span>
        <span className="guide-launcher__count" aria-hidden="true">
          {counter}
        </span>
        <span className="visually-hidden">{formatMessage(t.progress, { done: count.done, total: count.total })}</span>
      </button>
    </div>,
    document.body,
  )
}

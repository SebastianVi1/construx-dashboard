import { useEffect, useEffectEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from '../../components/icons'
import { formatMessage, useLocale } from '../../i18n'
import { progressText } from './entry'
import { useGuide } from './guide-context'
import './guide.css'

/** How long "You're set up" stays before the launcher goes away. */
const COMPLETION_MS = 6000

/** Radius of the progress ring in its 40 × 40 viewBox; the stroke is drawn on a 100-unit path. */
const RING_RADIUS = 17

/**
 * Bottom-right pill that opens the checklist: a progress ring around the
 * count ("2/5") and the next step's title ("Next: Create your first site").
 * It floats gently and, until the guide is first opened in this session,
 * glows now and then. When the last step is done it shows "You're set up"
 * once, then hides. Rendered through a portal so it floats above every screen.
 */
export function GuideLauncher() {
  const { launcherVisible, justCompleted, count, attention, open, acknowledgeCompletion } = useGuide()
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

  const counter = progressText(count, t)
  const done = count.total > 0 ? Math.min(100, (count.done / count.total) * 100) : 0
  const label = celebrating
    ? t.complete.title
    : count.next
      ? formatMessage(t.launcherNext, { step: t.steps[count.next.textKey].title })
      : t.launcher

  return createPortal(
    <div
      className="guide-launcher"
      data-state={celebrating ? 'complete' : 'open'}
      data-attention={(attention && !celebrating) || undefined}
    >
      <button
        type="button"
        className="guide-launcher__button"
        aria-haspopup="dialog"
        onClick={() => {
          acknowledgeCompletion()
          open()
        }}
      >
        <span className="guide-launcher__ring" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" focusable="false">
            <circle className="guide-launcher__ring-track" cx="20" cy="20" r={RING_RADIUS} pathLength="100" />
            <circle
              className="guide-launcher__ring-value"
              cx="20"
              cy="20"
              r={RING_RADIUS}
              pathLength="100"
              strokeDasharray={`${celebrating ? 100 : done} 100`}
            />
          </svg>
          {celebrating ? (
            <CheckIcon className="guide-launcher__ring-icon" width="16" height="16" strokeWidth="2.5" />
          ) : (
            <span className="guide-launcher__count" data-long={counter.short.length > 3 || undefined}>
              {counter.short}
            </span>
          )}
        </span>
        <span className="guide-launcher__label" aria-live="polite">
          {label}
        </span>
        {!celebrating && count.next ? (
          <svg className="guide-launcher__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        ) : null}
        <span className="visually-hidden">{counter.label}</span>
      </button>
    </div>,
    document.body,
  )
}

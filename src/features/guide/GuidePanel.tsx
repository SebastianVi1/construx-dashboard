import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { CheckIcon } from '../../components/icons'
import { Modal } from '../../components/modal'
import { getLandingUrl } from '../../config/env'
import { formatMessage, useLocale } from '../../i18n'
import type { GuideStepEntry, GuideStepId } from './catalog'
import { progressText } from './entry'
import { useGuide } from './guide-context'
import { NewTabIcon } from './GuideIcon'
import { GuideShowMe } from './GuideShowMe'
import { GuideStepNotice } from './GuideStepNotice'
import { GuideTourTimeline } from './GuideTourTimeline'
import { landingGuideHref } from './landing'
import { stepAdvance } from './guideState'
import { stepHint, stepStatus, type GuideSection } from './selection'
import './guide.css'

/**
 * The checklist: one heading per section, a row per step, the counter and
 * "Hide guide", under the guided tour's timeline once the member has started
 * the tour. In the dev preview a note replaces "Hide guide", and a role with
 * no steps gets a line saying so.
 *
 * Step by step: after a Skip, or when it opens on a step a page just
 * completed (that row's mark pops once), the row shows as finished and focus
 * moves on to the next open step's "Show me" (scrolled into view), or to the
 * progress when none is left ("You're set up" shows), so it never stays on a
 * removed button.
 */
export function GuidePanel() {
  const { sections, progress, count, dismissed, preview, close, hide, show, skip, lastDone, doneShown, tour } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide
  const panelRef = useRef<HTMLDivElement>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  // Each skip or step just done moves focus on once.
  const [advances, setAdvances] = useState(0)
  // The step whose mark pops: kept while the panel stays open, after the provider forgets it.
  const [popped, setPopped] = useState<GuideStepId | null>(null)
  const advance = stepAdvance(sections, progress, lastDone)
  if (advance !== null && advance.done.id !== popped) {
    setPopped(advance.done.id)
    setAdvances((n) => n + 1)
  }

  function skipStep(stepId: GuideStepId) {
    skip(stepId)
    setAdvances((n) => n + 1)
  }

  const moveOn = useEffectEvent(() => {
    if (lastDone !== null) doneShown()
    const next = count.next
    const target = next
      ? panelRef.current?.querySelector<HTMLElement>(`[data-step="${next.id}"] .guide-step__show`)
      : meterRef.current
    if (!target) return
    target.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    target.focus({ preventScroll: true })
  })

  // Runs after the render that shows the finished row, so the next step is already marked.
  useEffect(() => {
    if (advances > 0) moveOn()
  }, [advances])

  return (
    <Modal variant="dock" title={t.title} description={t.description} onClose={close} closeLabel={t.close}>
      <div ref={panelRef} className="guide-panel">
        {tour.visible && !preview ? <GuideTourTimeline /> : null}

        <div ref={meterRef} className="guide-meter" tabIndex={-1}>
          <p className="guide-meter__label">{progressText(count, t).label}</p>
          <ol className="guide-meter__track" aria-hidden="true">
            {Array.from({ length: count.total }, (_, index) => (
              <li key={index} className="guide-meter__tick" data-done={index < count.done} />
            ))}
          </ol>
        </div>

        {count.complete ? (
          <div className="guide-complete" role="status">
            <CheckIcon className="guide-complete__icon" />
            <div>
              <p className="guide-complete__title">{t.complete.title}</p>
              <p className="guide-complete__body">{t.complete.body}</p>
            </div>
          </div>
        ) : null}

        {sections.map((section) => (
          <GuideSectionList
            key={section.id}
            section={section}
            nextId={count.next?.id ?? null}
            poppedId={popped}
            onSkip={skipStep}
          />
        ))}

        {preview && sections.length === 0 ? <p className="guide-panel__empty">{t.preview.empty}</p> : null}

        <div className="guide-panel__footer">
          {preview ? (
            <p className="guide-panel__preview">{t.preview.note}</p>
          ) : dismissed ? (
            <button type="button" className="guide-panel__link" onClick={show}>
              {t.show}
            </button>
          ) : (
            <>
              <button type="button" className="guide-panel__link" onClick={hide}>
                {t.hide}
              </button>
              <p className="guide-panel__hint">{t.hideHint}</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function GuideSectionList({
  section,
  nextId,
  poppedId,
  onSkip,
}: {
  section: GuideSection
  nextId: string | null
  poppedId: string | null
  onSkip: (stepId: GuideStepId) => void
}) {
  const { messages: m } = useLocale()
  const headingId = useId()

  return (
    <section className="guide-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="guide-section__title">
        {m.guide.sections[section.titleKey]}
      </h3>
      <ol className="guide-steps">
        {section.steps.map((step) => (
          <GuideStepRow key={step.id} step={step} isNext={step.id === nextId} justDone={step.id === poppedId} onSkip={onSkip} />
        ))}
      </ol>
    </section>
  )
}

function GuideStepRow({
  step,
  isNext,
  justDone,
  onSkip,
}: {
  step: GuideStepEntry
  isNext: boolean
  justDone: boolean
  onSkip: (stepId: GuideStepId) => void
}) {
  const { progress, hasSites } = useGuide()
  const { messages: m, locale } = useLocale()
  const t = m.guide
  const text = t.steps[step.textKey]
  const status = stepStatus(progress, step.id)
  const hint = stepHint(step, status, hasSites)
  const learnMoreHref = landingGuideHref(getLandingUrl(), locale, step.chapter)

  return (
    <li
      className="guide-step"
      data-step={step.id}
      data-status={status?.toLowerCase() ?? 'open'}
      data-next={isNext || undefined}
      data-just-done={(justDone && status === 'COMPLETED') || undefined}
    >
      <span className="guide-step__mark" aria-hidden="true">
        {status !== null ? <CheckIcon width="14" height="14" strokeWidth="2.5" /> : null}
      </span>
      <div className="guide-step__text">
        <p className="guide-step__title">{text.title}</p>
        {status === null ? (
          <p className="guide-step__body">{text.body}</p>
        ) : (
          <p className="guide-step__state">{status === 'COMPLETED' ? t.done : t.skipped}</p>
        )}
        {hint ? <p className="guide-step__hint">{t.hints[hint]}</p> : null}
        <GuideStepNotice step={step} done={status !== null} />
        <div className="guide-step__actions">
          <GuideShowMe step={step} />
          {learnMoreHref ? (
            <a className="guide-step__more" href={learnMoreHref} target="_blank" rel="noopener noreferrer">
              {t.learnMore}
              <span className="visually-hidden"> {formatMessage(t.learnMoreLabel, { step: text.title })}</span>
              <NewTabIcon className="guide-step__more-icon" />
            </a>
          ) : null}
        </div>
      </div>
      {status === null ? (
        <SkipButton label={t.skip} accessibleLabel={formatMessage(t.skipLabel, { step: text.title })} onSkip={() => onSkip(step.id)} />
      ) : null}
    </li>
  )
}

/**
 * Skip one step. The skip shows at once and saves in the background (retried
 * when the panel opens again), so the row swaps this button for "Skipped" on
 * the next render. The ref ignores a second click that lands before then.
 */
function SkipButton({ label, accessibleLabel, onSkip }: { label: string; accessibleLabel: string; onSkip: () => void }) {
  const sent = useRef(false)

  return (
    <button
      type="button"
      className="button button--small guide-step__skip"
      aria-label={accessibleLabel}
      onClick={() => {
        if (sent.current) return
        sent.current = true
        onSkip()
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 6l7 6-7 6M13 6l7 6-7 6" />
      </svg>
      {label}
    </button>
  )
}

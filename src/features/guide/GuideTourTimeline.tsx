import { useEffect, useId, useRef } from 'react'
import { CheckIcon } from '../../components/icons'
import { formatMessage, useLocale } from '../../i18n'
import { useGuide } from './guide-context'
import type { TourStepEntry } from './tourCatalog'
import { firstUnfinishedTourStep, jumpableTourSteps, missingTourFacts, tourStepStatus } from './tourState'
import './guide.css'

/**
 * The guided tour's timeline at the top of the guide panel: one row per tour
 * step in catalog order (done, current or pending), then "Leave tour" while
 * the tour is on or "Continue tour" while a step is left. The current row is
 * the staged step: its text and "Start this step", which runs it. Reads only
 * the catalog, so a new tour step is a new row with no change here.
 */
export function GuideTourTimeline() {
  const { tour } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide.tourTimeline
  const headingId = useId()
  const { state, steps, facts } = tour
  const jumpable = new Set(jumpableTourSteps(state, facts, steps).map((step) => step.id))
  const unfinished = firstUnfinishedTourStep(state.done, facts, steps) !== null

  return (
    <section className="tour-timeline" aria-labelledby={headingId}>
      <div className="tour-timeline__header">
        <h3 id={headingId} className="guide-section__title">
          {t.title}
        </h3>
        <p className="tour-timeline__description">{t.description}</p>
      </div>

      <ol className="tour-timeline__steps">
        {steps.map((step, index) => (
          <TourTimelineRow key={step.id} step={step} number={index + 1} jumpable={jumpable.has(step.id)} />
        ))}
      </ol>

      {state.finished ? (
        <p className="tour-timeline__finished" role="status">
          <CheckIcon width="16" height="16" strokeWidth="2.5" aria-hidden="true" />
          {t.finished}
        </p>
      ) : null}

      {state.active ? (
        <div className="tour-timeline__footer">
          <button type="button" className="guide-panel__link" onClick={tour.leave}>
            {t.leave}
          </button>
        </div>
      ) : unfinished ? (
        <div className="tour-timeline__footer">
          <button type="button" className="button button--small button--primary" onClick={tour.continue}>
            {t.continue}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function TourTimelineRow({ step, number, jumpable }: { step: TourStepEntry; number: number; jumpable: boolean }) {
  const { tour } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide.tourTimeline
  const missingId = useId()
  const text = m.guide.tourSteps[step.textKey]
  const status = tourStepStatus(step, tour.state, tour.facts)
  const missing = status === 'pending' && !jumpable ? missingTourFacts(step, tour.facts) : []

  return (
    <li className="tour-step" data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
      <span className="tour-step__node" aria-hidden="true">
        {status === 'done' ? <CheckIcon width="14" height="14" strokeWidth="2.5" /> : number}
      </span>
      <div className="tour-step__text">
        <p className="tour-step__title">
          <span className="visually-hidden">{formatMessage(t.stepLabel, { number })}: </span>
          {text.title}
        </p>
        {status === 'current' ? (
          <>
            <p className="visually-hidden">{t.current}</p>
            <p className="tour-step__body">{tour.state.replaying ? text.replay : text.body}</p>
            {tour.state.failed ? <p className="tour-step__note" data-tone="failed">{t.failed}</p> : null}
            <TourRunButton key={tour.state.current} label={t.run} onRun={tour.run} />
          </>
        ) : (
          <p className="tour-step__state">{status === 'done' ? t.done : t.pending}</p>
        )}
        {missing.length > 0 ? (
          <ul id={missingId} className="tour-step__note" data-tone="missing">
            {missing.map((fact) => (
              <li key={fact}>{t.missing[fact]}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {status === 'done' ? (
        <button
          type="button"
          className="button button--small tour-step__action"
          aria-label={formatMessage(t.replayLabel, { step: text.title })}
          onClick={() => tour.jump(step.id)}
        >
          {t.replay}
        </button>
      ) : status === 'pending' ? (
        <button
          type="button"
          className="button button--small tour-step__action"
          aria-label={formatMessage(t.goLabel, { step: text.title })}
          aria-describedby={missing.length > 0 ? missingId : undefined}
          disabled={!jumpable}
          onClick={() => tour.jump(step.id)}
        >
          {t.go}
        </button>
      ) : null}
    </li>
  )
}

/**
 * "Start this step" on the staged row. It takes focus when it appears (the
 * panel opening on the tour, a replay chosen, the next step after a save), so
 * Enter runs the step. Focus waits a frame: the panel's dialog focuses itself
 * when it opens, after this row's effects run. It leaves focus alone when the
 * panel already put it on a control (the checklist's next step after a save
 * or a skip), so only one thing claims it.
 */
function TourRunButton({ label, onRun }: { label: string; onRun: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const button = ref.current
      const focused = document.activeElement
      const claimed = focused instanceof HTMLElement && focused !== document.body && focused.getAttribute('role') !== 'dialog'
      if (!button || claimed) return
      button.scrollIntoView({ block: 'nearest' })
      button.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <button ref={ref} type="button" className="button button--small button--primary tour-step__run" onClick={onRun}>
      {label}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  )
}

import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { isModalOpen } from '../../components/modal'
import { useLocale } from '../../i18n'
import type { GuideProgress } from './guideApi'
import { subscribeGuidedTour, type GuideMark } from './guideEvents'
import { guidePath } from './guidePaths'
import type { GuideSaves } from './guideSaves'
import type { GuideSection } from './selection'
import { destroyActiveTour, isPhoneWidth, startTour, tourStops } from './tour'
import { tourSpotlightTexts, tourSteps, type TourCatalog, type TourFacts, type TourStepId } from './tourCatalog'
import { forgetTourMemory, readTourMemory, rememberTourIds, tourFactsFrom, type TourMemory } from './tourMemory'
import {
  initialTourState,
  isTourStepDone,
  tourEntryCompletedBy,
  tourReducer,
  type TourEvent,
  type TourState,
} from './tourState'

export type GuidedTour = {
  /** The member can take the tour: they see the checklist's 'owner' section and can create Sites. */
  available: boolean
  /** The timeline shows: available and (active, ever started in this browser, or any step done). */
  visible: boolean
  state: TourState
  /** The current step is running (navigated, form open, spotlight). False while it is only staged in the panel, or inactive. */
  running: boolean
  steps: TourCatalog
  facts: TourFacts
  start: () => void
  continue: () => void
  jump: (stepId: TourStepId) => void
  /** "Start this step": run the staged current step. */
  run: () => void
  leave: () => void
  acknowledgeFinish: () => void
  /** The page opened the running step's pre-filled form (`useTourForm`). */
  prefillOpened: () => void
  /** The pre-filled form's save failed (`useTourForm`); the form stays open with its error. */
  prefillFailed: () => void
  /** The pre-filled form closed without a save (`useTourForm`): the panel reopens on the step with "Not saved yet". */
  prefillClosed: () => void
  /** For GuideProvider: hydrate on load and react to marks. `onMark` is true when it completed the running step (and reopens the panel itself). */
  hydrate: (progress: GuideProgress) => void
  onMark: (mark: GuideMark) => boolean
}

/** Section whose members can take the tour. */
const TOUR_SECTION = 'owner'

/** The built-in tour, typed so the selectors return its step ids. */
const catalog: TourCatalog = tourSteps

/**
 * The guided tour of one Company. Lives inside `GuideProvider` (a Company
 * switch remounts it). Timeline first: every way into a step (start,
 * continue, a timeline row, the dev "Start tour", a save that finished the
 * previous step) only *stages* it, opening the panel on the timeline with the
 * step's text. Nothing navigates, pre-fills or spotlights until "Start this
 * step" (`run`), which closes the panel first, so at most one modal is open.
 *
 * Staged vs running is this hook's `running` flag; the pure reducer doesn't
 * know about it. Completion comes only from the existing `markGuideStep`
 * marks, passed in through `onMark`, and counts only while the step runs.
 */
export function useGuidedTour({
  organizationId,
  sections,
  canCreateSites,
  saves,
  setOpen,
}: {
  organizationId: string
  sections: GuideSection[]
  /** The member holds MANAGE_PROJECT: `tour-site` creates a Site, so without it the tour would stall there. */
  canCreateSites: boolean
  saves: Pick<GuideSaves, 'step'>
  setOpen: (open: boolean) => void
}): GuidedTour {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { messages: m } = useLocale()
  const [state, dispatch] = useReducer(tourReducer, initialTourState)
  const [memory, setMemory] = useState<TourMemory>(() => readTourMemory(organizationId))
  const [running, setRunning] = useState(false)
  // Each run (and anything that ends one) takes a new number, so a spotlight that
  // ends late, after Leave or a newer run, can tell it is no longer the current run.
  const runNumber = useRef(0)
  const facts = tourFactsFrom(memory)
  const available = canCreateSites && sections.some((section) => section.id === TOUR_SECTION)
  const visible =
    available && (state.active || memory.started === true || catalog.some((step) => isTourStepDone(step, state.done, facts)))

  function markStarted() {
    if (memory.started !== true) setMemory(rememberTourIds(organizationId, { started: true }))
  }

  /** End whatever run or spotlight is going on. */
  function stopRunning() {
    runNumber.current += 1
    destroyActiveTour()
    setRunning(false)
  }

  /** Enter a step without running it: the panel opens on the timeline with the step's text. */
  function stage(event: TourEvent, from: TourState = state) {
    if (!available) return
    stopRunning()
    dispatch(event)
    if (tourReducer(from, event).active) setOpen(true)
  }

  /** A replay's spotlight ended: back to the staged row, unless that would open a second modal. */
  function endReplay(run: number) {
    if (runNumber.current !== run) return
    setRunning(false)
    // A click on the highlighted "Add site" also ends the spotlight and opens that dialog; let it render first.
    requestAnimationFrame(() => {
      if (runNumber.current === run && !isModalOpen()) setOpen(true)
    })
  }

  function run() {
    if (!available || !state.active || state.current === null) return
    const step = catalog.find((entry) => entry.id === state.current)
    const target = step ? guidePath(step.page, facts.siteId) : null
    if (!step || !target || target.needsSite) return
    // Re-enter the step: resets `prefillUsed` and `failed`, so the form opens again; a done step replays.
    const event: TourEvent = { type: 'jump', stepId: step.id, facts }
    const { replaying } = tourReducer(state, event)
    dispatch(event)
    runNumber.current += 1
    const thisRun = runNumber.current
    destroyActiveTour()
    setRunning(true)
    setOpen(false)
    if (`${pathname}${search}` !== target.path) navigate(target.path)
    // Phones get no spotlight: the staged row already showed the step's text, and the form opens by itself.
    if (isPhoneWidth()) {
      if (replaying) setRunning(false)
      return
    }
    const shown = replaying ? { ...step, tourTargets: step.replayTargets ?? step.tourTargets } : step
    const stops = tourStops([shown], tourSpotlightTexts(m.guide, replaying))
    // A missing target draws nothing. A running form step keeps its form and never gets the panel on top of it.
    void startTour(stops, m.guide.tour, replaying ? () => endReplay(thisRun) : undefined).then((result) => {
      if (result === 'fallback' && replaying) endReplay(thisRun)
    })
  }

  // The dev-only "Start tour": forget this browser's tour here and stage `at` again.
  // Saved server progress stays; a reload hydrates it back.
  const onRequest = useEffectEvent((at: TourStepId) => {
    if (!available) return
    forgetTourMemory(organizationId)
    setMemory(rememberTourIds(organizationId, { started: true }))
    dispatch({ type: 'reset' })
    stage({ type: 'startAt', stepId: at, facts: tourFactsFrom({}) }, initialTourState)
  })

  useEffect(() => subscribeGuidedTour(onRequest), [])

  function onMark(mark: GuideMark): boolean {
    // Only the running step completes: a Site added from the blank "Add site" while a step is staged isn't the tour's.
    if (!running) return false
    const step = tourEntryCompletedBy(state, mark.stepId, catalog)
    if (step === null) return false
    let next = memory
    // The one place created ids map to facts, one case per prefill key.
    if (mark.createdId !== undefined && step.prefill === 'site') {
      next = rememberTourIds(organizationId, { siteId: mark.createdId })
      setMemory(next)
    }
    // The step's spotlight is over, even when the form was sent with Enter rather than its highlighted button.
    stopRunning()
    dispatch({ type: 'stepSucceeded', stepId: step.id, facts: tourFactsFrom(next) })
    saves.step(step.id, 'COMPLETED')
    // Staged on the next unfinished step, or "Tour complete" after the last one.
    setOpen(true)
    return true
  }

  return {
    available,
    visible,
    state,
    running,
    steps: catalog,
    facts,
    start: () => {
      if (!available) return
      markStarted()
      stage({ type: 'start', facts })
    },
    continue: () => stage({ type: 'continue', facts }),
    jump: (stepId) => stage({ type: 'jump', stepId, facts }),
    run,
    leave: () => {
      stopRunning()
      dispatch({ type: 'leave' })
    },
    acknowledgeFinish: () => dispatch({ type: 'finishSeen' }),
    prefillOpened: () => dispatch({ type: 'prefillUsed' }),
    prefillFailed: () => {
      if (state.current !== null) dispatch({ type: 'stepFailed', stepId: state.current })
    },
    prefillClosed: () => {
      if (!running) return
      if (state.current !== null && !state.failed) dispatch({ type: 'stepFailed', stepId: state.current })
      stopRunning()
      setOpen(true)
    },
    hydrate: (progress) => dispatch({ type: 'hydrated', steps: progress.steps }),
    onMark,
  }
}

import type { GuideStepStatus } from './guideApi'
import {
  factHolds,
  tourStepForMark,
  tourSteps,
  type TourCatalog,
  type TourFact,
  type TourFacts,
  type TourIds,
  type TourPrefillKey,
  type TourStepEntry,
  type TourStepId,
} from './tourCatalog'

/**
 * The guided tour's state for one Company, as a pure reducer (like
 * `guideState.ts`). No position is persisted: after a reload the server's
 * progress (`hydrated`) and the facts say where the tour stands, and the first
 * unfinished step *is* the position.
 */
export type TourState<S extends string = TourStepId> = {
  /** The tour is driving the app (navigating, pre-filling, spotlighting). */
  active: boolean
  /** Step the tour is on while active; null when inactive. */
  current: S | null
  /** `current` is a done step shown again: spotlight and text only, no pre-fill, no completion. */
  replaying: boolean
  /** The current step's form was opened with its pre-fill (don't open it twice). Reset on entering a step. */
  prefillUsed: boolean
  /** The current step's action failed the last time (the form shows the error). Reset on entering a step and on success. */
  failed: boolean
  /** Steps saved COMPLETED or SKIPPED: the server's (hydrated) plus this session's. Catalog order not guaranteed. */
  done: readonly S[]
  /** The last open step was completed in this session and the end hasn't been acknowledged. */
  finished: boolean
}

export const initialTourState: TourState<never> = {
  active: false,
  current: null,
  replaying: false,
  prefillUsed: false,
  failed: false,
  done: [],
  finished: false,
}

export type TourEvent<S extends string = TourStepId> =
  /** Panel or launcher entry: the first unfinished step; all done → replay the first step. */
  | { type: 'start'; facts: TourFacts }
  /** Dev "Start tour": that step when it can start, replayed when done, otherwise as `start`. */
  | { type: 'startAt'; stepId: S; facts: TourFacts }
  /** "Continue tour": the first unfinished step; all done → inactive. */
  | { type: 'continue'; facts: TourFacts }
  /** A timeline row: replay a done step or enter a pending one whose facts hold. */
  | { type: 'jump'; stepId: S; facts: TourFacts }
  /** The page opened the pre-filled form. */
  | { type: 'prefillUsed' }
  /** Mapped from `markGuideStep`; `facts` already include the new id. */
  | { type: 'stepSucceeded'; stepId: S; facts: TourFacts }
  /** The tour-opened form's save failed. */
  | { type: 'stepFailed'; stepId: S }
  /** "Leave tour". */
  | { type: 'leave' }
  /** Server progress loaded (also after a reload). */
  | { type: 'hydrated'; steps: Readonly<Record<string, GuideStepStatus>> }
  /** Dev "Start tour" only: forget this session's tour state. */
  | { type: 'reset' }
  /** End message acknowledged. */
  | { type: 'finishSeen' }

/** Done when saved (or completed this session), or while its `doneWhen` fact holds. */
export function isTourStepDone<I extends TourIds>(step: TourStepEntry<I>, done: readonly I['step'][], facts: TourFacts): boolean {
  return done.includes(step.id) || (step.doneWhen !== undefined && factHolds(step.doneWhen, facts))
}

export function currentTourStep<I extends TourIds>(state: TourState<I['step']>, steps: TourCatalog<I>): TourStepEntry<I> | null {
  if (!state.active || state.current === null) return null
  return steps.find((step) => step.id === state.current) ?? null
}

export function firstUnfinishedTourStep<I extends TourIds>(
  done: readonly I['step'][],
  facts: TourFacts,
  steps: TourCatalog<I>,
): TourStepEntry<I> | null {
  return steps.find((step) => !isTourStepDone(step, done, facts)) ?? null
}

/** Where success on the current step leads: firstUnfinished with the current step counted as done; null at the end or when inactive. */
export function nextTourStep<I extends TourIds>(
  state: TourState<I['step']>,
  facts: TourFacts,
  steps: TourCatalog<I>,
): TourStepEntry<I> | null {
  const current = currentTourStep(state, steps)
  if (!current) return null
  return firstUnfinishedTourStep([...state.done, current.id], facts, steps)
}

/** Facts a step still needs, in its `requires` order (the timeline explains a disabled step with these). */
export function missingTourFacts(step: TourStepEntry<TourIds>, facts: TourFacts): TourFact[] {
  return step.requires.filter((fact) => !factHolds(fact, facts))
}

function isJumpable<I extends TourIds>(step: TourStepEntry<I>, done: readonly I['step'][], facts: TourFacts): boolean {
  return !isTourStepDone(step, done, facts) && step.requires.every((fact) => factHolds(fact, facts))
}

/** 'current' when active on it (also while replaying), else 'done' or 'pending'. */
export function tourStepStatus<I extends TourIds>(
  step: TourStepEntry<I>,
  state: TourState<I['step']>,
  facts: TourFacts,
): 'done' | 'current' | 'pending' {
  if (state.active && state.current === step.id) return 'current'
  return isTourStepDone(step, state.done, facts) ? 'done' : 'pending'
}

/** Pending steps a jump can reach now, in catalog order. */
export function jumpableTourSteps<I extends TourIds>(
  state: TourState<I['step']>,
  facts: TourFacts,
  steps: TourCatalog<I>,
): TourStepEntry<I>[] {
  return steps.filter((step) => tourStepStatus(step, state, facts) === 'pending' && isJumpable(step, state.done, facts))
}

/** The form the page should open pre-filled now: active, not replaying, not yet used, and the current step has `prefill`. */
export function tourPrefill<I extends TourIds>(state: TourState<I['step']>, steps: TourCatalog<I>): TourPrefillKey | null {
  if (state.replaying || state.prefillUsed) return null
  return currentTourStep(state, steps)?.prefill ?? null
}

/** The catalog entry a mark completes *now* (the same rule as `tourStepCompletedBy`), for callers that need more than its id. */
export function tourEntryCompletedBy<I extends TourIds>(
  state: TourState<I['step']>,
  markStepId: string,
  steps: TourCatalog<I>,
): TourStepEntry<I> | null {
  if (!state.active || state.replaying) return null
  const step = tourStepForMark(markStepId, steps)
  return step !== null && step.id === state.current ? step : null
}

/** The tour step a mark completes *now*: active, not replaying, and the mark maps to the current step; else null. */
export function tourStepCompletedBy<I extends TourIds>(
  state: TourState<I['step']>,
  markStepId: string,
  steps: TourCatalog<I>,
): I['step'] | null {
  return tourEntryCompletedBy(state, markStepId, steps)?.id ?? null
}

function enter<S extends string>(state: TourState<S>, stepId: S, replaying: boolean, restart = false): TourState<S> {
  return {
    ...state,
    active: true,
    current: stepId,
    replaying,
    prefillUsed: false,
    failed: false,
    finished: restart ? false : state.finished,
  }
}

/** Enter the first unfinished step; with every step done, replay the first one (`start`). */
function startTour<I extends TourIds>(state: TourState<I['step']>, facts: TourFacts, steps: TourCatalog<I>): TourState<I['step']> {
  const next = firstUnfinishedTourStep(state.done, facts, steps)
  if (next) return enter(state, next.id, false, true)
  const first = steps[0]
  return first ? enter(state, first.id, true, true) : state
}

/**
 * With a catalog (tests), or with the built-in `tourSteps`. The two-argument
 * form is declared last so `useReducer(tourReducer, …)` infers it.
 */
export function tourReducer<I extends TourIds>(
  state: TourState<I['step']>,
  event: TourEvent<I['step']>,
  steps: TourCatalog<I>,
): TourState<I['step']>
export function tourReducer(state: TourState, event: TourEvent): TourState
export function tourReducer(
  state: TourState<string>,
  event: TourEvent<string>,
  steps: TourCatalog<TourIds> = tourSteps,
): TourState<string> {
  const find = (stepId: string) => steps.find((step) => step.id === stepId)
  switch (event.type) {
    case 'start':
      return startTour(state, event.facts, steps)
    case 'startAt': {
      const step = find(event.stepId)
      if (!step) return state
      if (isTourStepDone(step, state.done, event.facts)) return enter(state, step.id, true, true)
      if (isJumpable(step, state.done, event.facts)) return enter(state, step.id, false, true)
      return startTour(state, event.facts, steps)
    }
    case 'continue': {
      const next = firstUnfinishedTourStep(state.done, event.facts, steps)
      if (next) return enter(state, next.id, false, true)
      return { ...state, active: false, current: null }
    }
    case 'jump': {
      const step = find(event.stepId)
      if (!step) return state
      if (isTourStepDone(step, state.done, event.facts)) return enter(state, step.id, true)
      if (isJumpable(step, state.done, event.facts)) return enter(state, step.id, false)
      return state
    }
    case 'prefillUsed':
      return state.active && !state.replaying && !state.prefillUsed ? { ...state, prefillUsed: true } : state
    case 'stepSucceeded': {
      if (!state.active || state.replaying || state.current !== event.stepId) return state
      const done = state.done.includes(event.stepId) ? state.done : [...state.done, event.stepId]
      const next = firstUnfinishedTourStep(done, event.facts, steps)
      if (next) return enter({ ...state, done }, next.id, false)
      return { ...state, done, active: false, current: null, replaying: false, prefillUsed: false, failed: false, finished: true }
    }
    case 'stepFailed':
      if (!state.active || state.replaying || state.current !== event.stepId) return state
      return state.failed ? state : { ...state, failed: true }
    case 'leave':
      return { ...state, active: false, current: null, replaying: false, prefillUsed: false, failed: false }
    case 'hydrated': {
      const saved = steps
        .map((step) => step.id)
        .filter((id) => !state.done.includes(id) && (event.steps[id] === 'COMPLETED' || event.steps[id] === 'SKIPPED'))
      return saved.length === 0 ? state : { ...state, done: [...state.done, ...saved] }
    }
    case 'reset':
      return initialTourState
    case 'finishSeen':
      return state.finished ? { ...state, finished: false } : state
  }
}

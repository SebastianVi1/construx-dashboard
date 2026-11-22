import type { GuideIds, GuideStepEntry, GuideStepId } from './catalog'
import type { GuideProgress, GuideStepStatus } from './guideApi'
import { guideProgressOf, stepStatus, type GuideSection } from './selection'

/**
 * The guide's progress for one Company as the session sees it: the server's
 * answer with this session's changes applied at once, before their saves
 * finish. Changes made before the first load survive it.
 */
export type GuideState = {
  loaded: boolean
  progress: GuideProgress
  /** Hide or show was chosen in this session; a late load must not undo it. */
  dismissChosen: boolean
  /**
   * A change in this session did the last open step and "You're set up"
   * hasn't been acknowledged. Decided only once progress has loaded, against
   * the progress the change produced.
   */
  justCompleted: boolean
  /**
   * The dev-only preview ("Start tour"): the checklist as a brand-new member
   * sees it, with this preview's skips. Never saved; null when not previewing.
   */
  preview: GuideProgress | null
  /**
   * A step a page just completed for real (its status changed to COMPLETED in
   * this session, outside a preview, after progress loaded) that the panel
   * hasn't shown yet. The panel opens on it (`completionFollowUp`), ticks it
   * and moves on to the next step (`stepAdvance`), then `stepDoneShown` clears it.
   */
  lastDone: GuideStepId | null
}

/** `sections` on `loaded` and `marked`: the member's checklist then, to tell whether the guide is complete. */
export type GuideAction =
  | { type: 'loaded'; progress: GuideProgress; sections: GuideSection[] }
  | { type: 'marked'; stepId: GuideStepId; status: GuideStepStatus; at: string; sections: GuideSection[] }
  | { type: 'dismissed'; dismissed: boolean; at: string }
  | { type: 'acknowledged' }
  | { type: 'previewStarted' }
  | { type: 'previewMarked'; stepId: GuideStepId; status: GuideStepStatus }
  | { type: 'previewEnded' }
  | { type: 'stepDoneShown' }

const notStarted: GuideProgress = { started: false, steps: {}, dismissedAt: null, updatedAt: null }

export const initialGuideState: GuideState = {
  loaded: false,
  progress: notStarted,
  dismissChosen: false,
  justCompleted: false,
  preview: null,
  lastDone: null,
}

/** The progress the panel shows: the preview's while previewing, otherwise the real one. */
export function shownProgress(state: GuideState): GuideProgress {
  return state.preview ?? state.progress
}

function complete(sections: GuideSection[], progress: GuideProgress): boolean {
  return guideProgressOf(sections, progress).complete
}

export function guideReducer(state: GuideState, action: GuideAction): GuideState {
  const local = state.progress
  switch (action.type) {
    case 'loaded': {
      const server = action.progress
      const progress: GuideProgress = {
        started: server.started || local.started,
        steps: { ...server.steps, ...local.steps },
        dismissedAt: state.dismissChosen ? local.dismissedAt : server.dismissedAt,
        updatedAt: local.updatedAt ?? server.updatedAt,
      }
      // Marks made before the load finished the guide only if the server's progress alone didn't.
      const finishedHere = complete(action.sections, progress) && !complete(action.sections, server)
      return { ...state, loaded: true, progress, justCompleted: state.justCompleted || finishedHere }
    }
    case 'marked': {
      if (local.steps[action.stepId] === 'COMPLETED') return state
      const progress: GuideProgress = {
        ...local,
        started: true,
        steps: { ...local.steps, [action.stepId]: action.status },
        updatedAt: action.at,
      }
      // Before the load the server may already hold the other steps (or this one); the load decides then.
      const finishedHere = state.loaded && complete(action.sections, progress) && !complete(action.sections, local)
      // Before the load the server may already hold it, so only a mark after the load counts as new.
      const doneHere = action.status === 'COMPLETED' && state.loaded && state.preview === null
      return {
        ...state,
        progress,
        justCompleted: state.justCompleted || finishedHere,
        lastDone: doneHere ? action.stepId : state.lastDone,
      }
    }
    case 'dismissed':
      return {
        ...state,
        dismissChosen: true,
        progress: {
          ...local,
          started: true,
          dismissedAt: action.dismissed ? (local.dismissedAt ?? action.at) : null,
          updatedAt: action.at,
        },
      }
    case 'acknowledged':
      return state.justCompleted ? { ...state, justCompleted: false } : state
    case 'previewStarted':
      return { ...state, preview: notStarted }
    case 'previewMarked':
      if (!state.preview) return state
      return { ...state, preview: { ...state.preview, steps: { ...state.preview.steps, [action.stepId]: action.status } } }
    case 'previewEnded':
      return state.preview ? { ...state, preview: null } : state
    case 'stepDoneShown':
      return state.lastDone === null ? state : { ...state, lastDone: null }
  }
}

/**
 * What a step a page just completed leads to: `open` the panel on it, `drop`
 * it (the guide is hidden, a preview is showing, or the step is no longer in
 * the member's `sections`), or `none` (nothing new). The caller also waits
 * until no other modal is open before opening, and drops it when the guided
 * tour already reopens the panel for the same mark.
 */
export function completionFollowUp<I extends GuideIds>(state: GuideState, sections: readonly GuideSection<I>[]): 'open' | 'drop' | 'none' {
  if (state.lastDone === null) return 'none'
  const hidden = state.progress.dismissedAt !== null || state.preview !== null
  return hidden || stepAdvance(sections, state.progress, state.lastDone) === null ? 'drop' : 'open'
}

/**
 * The panel's step-by-step move after `done`: that step (to tick) and the
 * first open step the member sees, in display order (to highlight and focus),
 * or `next: null` when none is left ("You're set up" shows). Null when nothing
 * was just done or the step isn't in the member's checklist.
 */
export function stepAdvance<I extends GuideIds>(
  sections: readonly GuideSection<I>[],
  progress: GuideProgress,
  done: string | null,
): { done: GuideStepEntry<I>; next: GuideStepEntry<I> | null } | null {
  if (done === null) return null
  const steps = sections.flatMap((section) => section.steps)
  const entry = steps.find((step) => step.id === done)
  if (!entry) return null
  return { done: entry, next: guideProgressOf(sections, progress).next }
}

/**
 * Whether a mark changes anything worth saving: the step is one the member
 * sees, it isn't completed yet, and the status is new. A skipped step can
 * still be completed.
 */
export function acceptsMark<I extends GuideIds>(
  sections: readonly GuideSection<I>[],
  progress: GuideProgress,
  stepId: I['step'],
  status: GuideStepStatus,
): boolean {
  const visible = sections.some((section) => section.steps.some((step) => step.id === stepId))
  const current = stepStatus(progress, stepId)
  return visible && current !== 'COMPLETED' && current !== status
}

import type { GuideProgress, GuideStepStatus } from './guideApi'
import { stepStatus, type GuideSection } from './selection'

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
}

export type GuideAction =
  | { type: 'loaded'; progress: GuideProgress }
  | { type: 'marked'; stepId: string; status: GuideStepStatus; at: string }
  | { type: 'dismissed'; dismissed: boolean; at: string }

export const initialGuideState: GuideState = {
  loaded: false,
  progress: { started: false, steps: {}, dismissedAt: null, updatedAt: null },
  dismissChosen: false,
}

export function guideReducer(state: GuideState, action: GuideAction): GuideState {
  const local = state.progress
  switch (action.type) {
    case 'loaded': {
      const server = action.progress
      return {
        ...state,
        loaded: true,
        progress: {
          started: server.started || local.started,
          steps: { ...server.steps, ...local.steps },
          dismissedAt: state.dismissChosen ? local.dismissedAt : server.dismissedAt,
          updatedAt: local.updatedAt ?? server.updatedAt,
        },
      }
    }
    case 'marked': {
      if (local.steps[action.stepId] === 'COMPLETED') return state
      return {
        ...state,
        progress: {
          ...local,
          started: true,
          steps: { ...local.steps, [action.stepId]: action.status },
          updatedAt: action.at,
        },
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
  }
}

/**
 * Whether a mark changes anything worth saving: the step is one the member
 * sees, it isn't completed yet, and the status is new. A skipped step can
 * still be completed.
 */
export function acceptsMark(
  sections: GuideSection[],
  progress: GuideProgress,
  stepId: string,
  status: GuideStepStatus,
): boolean {
  const visible = sections.some((section) => section.steps.some((step) => step.id === stepId))
  const current = stepStatus(progress, stepId)
  return visible && current !== 'COMPLETED' && current !== status
}

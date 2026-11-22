import type { GuideStepId } from './catalog'
import type { GuideStepStatus } from './guideApi'
import type { GuideSaves } from './guideSaves'
import { acceptsMark, type GuideAction, type GuideState } from './guideState'
import type { GuideSection } from './selection'

export type GuideCommands = {
  /** A page reported the member really did the step: shown and saved, even while previewing. */
  complete: (stepId: GuideStepId) => void
  /** Skip a step from the checklist. While previewing it shows only in the preview and is not saved. */
  skip: (stepId: GuideStepId) => void
  /** Hide (true) or show (false) the guide. Ignored while previewing. */
  setDismissed: (dismissed: boolean) => void
}

/**
 * What the member's choices change, applied through `dispatch` and `saves`.
 * The only place that decides a save, so a preview never writes to the server.
 */
export function guideCommands({
  state,
  sections,
  saves,
  dispatch,
  now = () => new Date().toISOString(),
}: {
  state: GuideState
  sections: GuideSection[]
  saves: Pick<GuideSaves, 'step' | 'dismiss'>
  dispatch: (action: GuideAction) => void
  now?: () => string
}): GuideCommands {
  function apply(stepId: GuideStepId, status: GuideStepStatus) {
    if (!acceptsMark(sections, state.progress, stepId, status)) return
    dispatch({ type: 'marked', stepId, status, at: now(), sections })
    saves.step(stepId, status)
  }

  return {
    complete: (stepId) => apply(stepId, 'COMPLETED'),
    skip: (stepId) => {
      if (!state.preview) return apply(stepId, 'SKIPPED')
      if (acceptsMark(sections, state.preview, stepId, 'SKIPPED')) dispatch({ type: 'previewMarked', stepId, status: 'SKIPPED' })
    },
    setDismissed: (dismissed) => {
      if (state.preview) return
      dispatch({ type: 'dismissed', dismissed, at: now() })
      saves.dismiss(dismissed)
    },
  }
}

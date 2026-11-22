import type { GuideStepId } from './catalog'
import type { GuideStepStatus } from './guideApi'
import type { TourStepId } from './tourCatalog'

/** A checklist step or a guided tour step; both are saved the same way. */
export type GuideSaveStepId = GuideStepId | TourStepId

// `markStep` and `step` are methods so a fake typed to checklist ids only still fits.
export type GuideServer = {
  markStep(stepId: GuideSaveStepId, status: GuideStepStatus): Promise<unknown>
  setDismissed: (dismissed: boolean) => Promise<unknown>
}

export type GuideSaves = {
  step(stepId: GuideSaveStepId, status: GuideStepStatus): void
  dismiss: (dismissed: boolean) => void
  /** Send again every save whose latest attempt failed. `GuideProvider` calls it each time the panel opens. */
  retryFailed: () => void
}

/**
 * Saves for one Company's progress. The screen already shows the change, so
 * a failed save shows no error: it is remembered and sent again on the next
 * `retryFailed`. Only the latest save of a step (or of hide/show) counts, so
 * a retry never overwrites a newer choice.
 */
export function createGuideSaves(server: GuideServer): GuideSaves {
  let sequence = 0
  const latest = new Map<string, number>()
  const failed = new Map<string, () => void>()

  function send(key: string, attempt: () => Promise<unknown>) {
    const id = ++sequence
    latest.set(key, id)
    failed.delete(key)
    attempt().catch(() => {
      if (latest.get(key) === id) failed.set(key, () => send(key, attempt))
    })
  }

  return {
    step: (stepId, status) => send(`step:${stepId}`, () => server.markStep(stepId, status)),
    dismiss: (dismissed) => send('dismiss', () => server.setDismissed(dismissed)),
    retryFailed: () => {
      const pending = [...failed.values()]
      failed.clear()
      for (const retry of pending) retry()
    },
  }
}

import type { GuideStepStatus } from './guideApi'

export type GuideServer = {
  markStep: (stepId: string, status: GuideStepStatus) => Promise<unknown>
  setDismissed: (dismissed: boolean) => Promise<unknown>
}

export type GuideSaves = {
  step: (stepId: string, status: GuideStepStatus) => void
  dismiss: (dismissed: boolean) => void
  /** Send again every save whose latest attempt failed. Call it when the panel opens. */
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

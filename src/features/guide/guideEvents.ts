/**
 * Completion signals. A page calls `markGuideStep` after the real API call
 * succeeds; the guide's state, when mounted, listens and ticks the step off.
 * Pages never import the guide's state, and with no listener a mark does
 * nothing.
 */

export type GuideMark = {
  stepId: string
  /** Company the action happened in; a mark for another Company is ignored. Null when the caller doesn't say. */
  organizationId: string | null
}

type Listener = (mark: GuideMark) => void

const listeners = new Set<Listener>()

/** Report that the member really did a step's action. Call it only after the API call succeeds. */
export function markGuideStep(stepId: string, organizationId?: string): void {
  const mark: GuideMark = { stepId, organizationId: organizationId ?? null }
  for (const listener of [...listeners]) listener(mark)
}

/** Listen for marks; returns the function that stops listening. */
export function subscribeGuideSteps(listener: Listener): () => void {
  // Wrap so the same function subscribed twice still gets two independent subscriptions.
  const entry: Listener = (mark) => listener(mark)
  listeners.add(entry)
  return () => {
    listeners.delete(entry)
  }
}

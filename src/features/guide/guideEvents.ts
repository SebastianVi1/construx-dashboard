/**
 * Signals from pages to the guide. A page calls `markGuideStep` after the real
 * API call succeeds, and `reportGuideSites` once it knows whether the member
 * is on any Site; the guide's state, when mounted, listens. Pages never import
 * the guide's state, and with no listener a signal does nothing.
 */

export type GuideMark = {
  stepId: string
  /** Company the action happened in; a mark for another Company is ignored. Null when the caller doesn't say. */
  organizationId: string | null
}

/** Whether the member sees any open Site in a Company (for hints such as "ask your administrator"). */
export type GuideSitesReport = { organizationId: string; hasSites: boolean }

function channel<T>() {
  const listeners = new Set<(value: T) => void>()
  return {
    emit(value: T) {
      for (const listener of [...listeners]) listener(value)
    },
    subscribe(listener: (value: T) => void): () => void {
      // Wrap so the same function subscribed twice still gets two independent subscriptions.
      const entry = (value: T) => listener(value)
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
  }
}

const marks = channel<GuideMark>()
const sites = channel<GuideSitesReport>()

/** Report that the member really did a step's action. Call it only after the API call succeeds. */
export function markGuideStep(stepId: string, organizationId?: string): void {
  marks.emit({ stepId, organizationId: organizationId ?? null })
}

/** Listen for marks; returns the function that stops listening. */
export function subscribeGuideSteps(listener: (mark: GuideMark) => void): () => void {
  return marks.subscribe(listener)
}

/** Report whether the member's list of open Sites in a Company has any. Call it only after the list loaded. */
export function reportGuideSites(organizationId: string, hasSites: boolean): void {
  sites.emit({ organizationId, hasSites })
}

/** Listen for Site reports; returns the function that stops listening. */
export function subscribeGuideSites(listener: (report: GuideSitesReport) => void): () => void {
  return sites.subscribe(listener)
}

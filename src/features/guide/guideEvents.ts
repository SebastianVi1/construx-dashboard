import type { GuideStepId } from './catalog'
import type { TourStepId } from './tourCatalog'

/**
 * Signals from pages to the guide. A page calls `markGuideStep` after the real
 * API call succeeds, `reportGuideSites` once it knows whether the member is on
 * any Site, and `reportGuideSiteOpened` once a Site page loaded its Site; the
 * guide's state, when mounted, listens (as it does to `requestGuidePreview`). Pages never import the guide's state,
 * and with no listener a signal does nothing.
 */

export type GuideMark = {
  stepId: GuideStepId
  /** Company the action happened in; a mark for another Company is ignored. */
  organizationId: string
  /** Id of what the action created (a create mark only); the guided tour remembers it. Absent on other marks. */
  createdId?: string
}

/** Whether the member sees any open Site in a Company (for hints such as "ask your administrator"). */
export type GuideSitesReport = { organizationId: string; hasSites: boolean }

/** A Site that loaded on its page, so the guide knows it belongs to that Company. */
export type GuideSiteOpened = { organizationId: string; siteId: string }

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
const openedSites = channel<GuideSiteOpened>()
const previews = channel<void>()
const tours = channel<TourStepId>()

/**
 * Report that the member really did a step's action. Call it only after the
 * API call succeeds. A create passes the new record's id as `createdId`.
 */
export function markGuideStep(stepId: GuideStepId, organizationId: string, createdId?: string): void {
  marks.emit(createdId === undefined ? { stepId, organizationId } : { stepId, organizationId, createdId })
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

/** Report that a Site's page loaded it. Call it only after the Site loaded. */
export function reportGuideSiteOpened(organizationId: string, siteId: string): void {
  openedSites.emit({ organizationId, siteId })
}

/** Listen for opened Sites; returns the function that stops listening. */
export function subscribeGuideSiteOpened(listener: (site: GuideSiteOpened) => void): () => void {
  return openedSites.subscribe(listener)
}

/**
 * Ask the guide to open its checklist preview and start the first step's tour
 * (the dev-only "Preview checklist" in the account menu, which sits outside the guide).
 */
export function requestGuidePreview(): void {
  previews.emit()
}

/** Listen for preview requests; returns the function that stops listening. */
export function subscribeGuidePreview(listener: () => void): () => void {
  return previews.subscribe(listener)
}

/**
 * Ask the current Company's guide to restart the guided tour at a step (the
 * dev-only "Start tour" in the account menu). With no guide mounted it does nothing.
 */
export function requestGuidedTour(at: TourStepId): void {
  tours.emit(at)
}

/** Listen for guided tour requests; returns the function that stops listening. */
export function subscribeGuidedTour(listener: (at: TourStepId) => void): () => void {
  return tours.subscribe(listener)
}

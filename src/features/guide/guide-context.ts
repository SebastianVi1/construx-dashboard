import { createContext, useContext } from 'react'
import type { GuideStepId } from './catalog'
import type { GuideProgress } from './guideApi'
import type { GuideCount, GuideSection } from './selection'
import type { TourPrefillKey } from './tourCatalog'
import { currentTourStep, tourPrefill } from './tourState'
import type { GuidedTour } from './useGuidedTour'
import type { GuideTours } from './useGuideTours'

export type GuideContextValue = {
  /** The member's checklist in this Company; empty when they have no steps. */
  sections: GuideSection[]
  /** This session's view of the saved progress (changes show before their saves finish). */
  progress: GuideProgress
  count: GuideCount
  /** Whether the member sees any open Site in this Company; null until a page has loaded their Sites. */
  hasSites: boolean | null
  /** The guide is hidden: no launcher, but the sidebar entry still opens it. */
  dismissed: boolean
  isOpen: boolean
  /** The launcher is showing (and the panel closed). */
  launcherVisible: boolean
  /** The last open step was done in this session and "You're set up" hasn't been seen yet. */
  justCompleted: boolean
  /**
   * The dev-only preview is on: `sections` as a brand-new member sees them
   * (`progress`, `count` and `dismissed` are the preview's) and nothing is saved.
   */
  preview: boolean
  /** Open the panel. Whatever opens it, failed saves are sent again. */
  open: () => void
  close: () => void
  skip: (stepId: GuideStepId) => void
  /** Hide the guide (the launcher goes away). */
  hide: () => void
  /** Bring the launcher back after hiding the guide. */
  show: () => void
  /** "You're set up" has been seen. */
  acknowledgeCompletion: () => void
  /** A step a page just completed that the panel should tick and move on from (`stepAdvance`); null otherwise. */
  lastDone: GuideStepId | null
  /** The panel showed `lastDone`. */
  doneShown: () => void
  /** The member hasn't opened the guide in this session yet: the launcher glows now and then. */
  attention: boolean
  /** The guided tour of this Company (its timeline sits at the top of the panel). */
  tour: Omit<GuidedTour, 'hydrate' | 'onMark'>
} & Omit<GuideTours, 'clearNotice'>

export const GuideContext = createContext<GuideContextValue | undefined>(undefined)

export function useGuide(): GuideContextValue {
  const context = useContext(GuideContext)
  if (!context) throw new Error('useGuide must be used within a GuideProvider')
  return context
}

export type TourFormRequest = {
  /** The tour wants this form open with its example values now (only while the step is running). */
  requested: boolean
  /** The tour is running a step that uses this form. When it turns false, the page closes a tour-opened form ("Leave tour", a save). */
  running: boolean
  /** Call once the form is open, so it isn't opened again for this run. */
  opened: () => void
  /** Call when the form's save failed (the form stays open and shows the error). */
  failed: () => void
  /** Call when the tour-opened form closes without a save (Cancel, Esc, close button): the panel reopens with "Not saved yet". */
  closed: () => void
}

const inertForm: TourFormRequest = { requested: false, running: false, opened: () => {}, failed: () => {}, closed: () => {} }

/**
 * Whether the guided tour wants the page's `key` form open pre-filled. A page
 * opens the form when `requested` turns true, then calls `opened()`; the form
 * calls `failed()` when its save fails and `closed()` when it closes unsaved.
 * When `running` turns false the page closes a tour-opened form without
 * reporting. Inert (false, no-op callbacks) outside a GuideProvider, while
 * the step is replayed, or when the current step owns another form.
 */
export function useTourForm(key: TourPrefillKey): TourFormRequest {
  const tour = useContext(GuideContext)?.tour
  if (!tour || tour.state.replaying || currentTourStep(tour.state, tour.steps)?.prefill !== key) return inertForm
  return {
    requested: tour.running && tourPrefill(tour.state, tour.steps) === key,
    running: tour.running,
    opened: tour.prefillOpened,
    failed: tour.prefillFailed,
    closed: tour.prefillClosed,
  }
}

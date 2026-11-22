import {
  GUIDE_MAX_STEPS,
  GUIDE_STEP_ID,
  TOUR_TARGET,
  type GuideCatalog,
  type GuideIds,
  type GuidePageId,
  type GuideStepId,
} from './catalog'
import type { guideMessages } from './messages'
import type { GuideText } from './tour'

/**
 * The guided tour: an ordered walk-through, separate from the checklist
 * (`catalog.ts`). Tour steps are gated by facts, never counted in "2/5", and
 * saved on the server under their own `tour-…` ids. A new step is an entry
 * here plus its text in `messages.ts` (see the guide README, "Adding a tour
 * step"); the reducer, the timeline and the provider never name an id.
 */

/** Facts a tour step can require. Later tickets add more (a phase, a task, a plan…). */
export type TourFact = 'hasCompany' | 'hasSite'

/** What the provider knows when it evaluates prerequisites. */
export type TourFacts = {
  /** The member is inside a Company. Always true inside `GuideProvider`. */
  hasCompany: boolean
  /** Site the tour created in this Company (browser memory), or null. */
  siteId: string | null
}

export function factHolds(fact: TourFact, facts: TourFacts): boolean {
  switch (fact) {
    case 'hasCompany':
      return facts.hasCompany
    case 'hasSite':
      return facts.siteId !== null
  }
}

/** Forms the tour can open pre-filled. The page that owns the form maps the key to its builder. */
export type TourPrefillKey = 'site'

/** Ids a tour catalog uses. A test catalog uses plain strings (`TourCatalog<TourIds>`), as `GuideIds` does for the checklist. */
export type TourIds = { step: string; page: string; target: string; checklist: string }

export type TourStepEntry<I extends TourIds = TourCatalogIds> = {
  /** Saved on the server like a checklist id: must match GUIDE_STEP_ID, start with 'tour-', never change once shipped. */
  id: I['step']
  /** A page id of `guidePages` (reused, not duplicated). */
  page: I['page']
  /** Prerequisites: every fact must hold to jump to or start at this step. */
  requires: readonly TourFact[]
  /** Optional: the step counts as done while this fact holds, even when no save reached the server. */
  doneWhen?: TourFact
  /** `data-tour` targets spotlighted while the step is current, in order. */
  tourTargets: readonly I['target'][]
  /** Targets spotlighted when a done step is replayed (no form opens on a replay). Defaults to `tourTargets`. */
  replayTargets?: readonly I['target'][]
  /** Form the step opens with example values. Absent: nothing is pre-filled. */
  prefill?: TourPrefillKey
  /**
   * Checklist step whose `markGuideStep` completes this tour step. The same mark
   * already ticks that checklist step through the existing path. Absent: the step
   * is completed by a mark with its own id.
   */
  checklistStep?: I['checklist']
  /** Title and body, from `messages.guide.tourSteps`. */
  textKey: keyof typeof guideMessages.en.tourSteps
}

export type TourCatalog<I extends TourIds = TourCatalogIds> = readonly TourStepEntry<I>[]

/** The tour, in the order a member walks it. */
export const tourSteps = [
  {
    id: 'tour-site',
    page: 'sites',
    requires: ['hasCompany'],
    doneWhen: 'hasSite',
    tourTargets: ['site-create-save'],
    replayTargets: ['site-create'],
    prefill: 'site',
    checklistStep: 'create-site',
    textKey: 'site',
  },
] as const satisfies readonly TourStepEntry<{ step: string; page: GuidePageId; target: string; checklist: GuideStepId }>[]

export type TourStepId = (typeof tourSteps)[number]['id']
export type TourTarget =
  | (typeof tourSteps)[number]['tourTargets'][number]
  | NonNullable<(typeof tourSteps)[number]['replayTargets']>[number]
export type TourCatalogIds = { step: TourStepId; page: GuidePageId; target: TourTarget; checklist: GuideStepId }

/** The tour step a mark completes (by `checklistStep` or by its own id), or null. */
export function tourStepForMark<I extends TourIds>(markStepId: string, steps: TourCatalog<I>): TourStepEntry<I> | null {
  return (
    steps.find((step) => step.checklistStep === markStepId) ?? steps.find((step) => step.id === markStepId) ?? null
  )
}

/** Tour copy as `messages.guide` holds it: each step's `replay` text replaces its body on a replay. */
export type TourTexts = {
  tourSteps: Readonly<Record<string, GuideText & { replay: string }>>
  targets: Partial<Record<string, GuideText>>
}

/** What `tourStops` reads: step texts by `textKey` and per-target popovers. */
export type SpotlightTexts = { steps: Record<string, GuideText>; targets: Partial<Record<string, GuideText>> }

/**
 * The texts `tourStops` reads for a tour step's spotlight. A running step
 * shows its targets' own popovers (`targets`), falling back to the step's
 * body. A replay shows the step's `replay` text on every target and never
 * the checklist's target copy, which describes a different moment.
 */
export function tourSpotlightTexts(texts: TourTexts, replaying: boolean): SpotlightTexts {
  if (!replaying) return { steps: texts.tourSteps, targets: texts.targets }
  const steps: Record<string, GuideText> = {}
  for (const [key, text] of Object.entries(texts.tourSteps)) steps[key] = { title: text.title, body: text.replay }
  return { steps, targets: {} }
}

const TOUR_PREFIX = 'tour-'

/** Mistakes in a tour catalog checked against the checklist catalog, one sentence each; `[]` when it fits. */
export function tourCatalogProblems(tour: TourCatalog<TourIds>, checklist: GuideCatalog<GuideIds>): string[] {
  const problems: string[] = []
  const checklistIds = new Set(checklist.steps.map((step) => step.id))
  const pageIds = new Set(checklist.pages.map((page) => page.id))
  const ids = new Set<string>()
  const marks = new Map<string, string>()
  for (const step of tour) {
    if (!GUIDE_STEP_ID.test(step.id)) problems.push(`tour step "${step.id}": id must match ${GUIDE_STEP_ID.source}`)
    if (!step.id.startsWith(TOUR_PREFIX)) problems.push(`tour step "${step.id}": id must start with "${TOUR_PREFIX}"`)
    if (ids.has(step.id)) problems.push(`tour step "${step.id}": duplicate id`)
    ids.add(step.id)
    if (checklistIds.has(step.id)) problems.push(`tour step "${step.id}": id clashes with a checklist step`)
    if (!pageIds.has(step.page)) problems.push(`tour step "${step.id}": unknown page "${step.page}"`)
    if (step.checklistStep !== undefined) {
      if (!checklistIds.has(step.checklistStep)) {
        problems.push(`tour step "${step.id}": unknown checklist step "${step.checklistStep}"`)
      }
      const other = marks.get(step.checklistStep)
      if (other !== undefined) {
        problems.push(`tour step "${step.id}": checklist step "${step.checklistStep}" already completes "${other}"`)
      } else {
        marks.set(step.checklistStep, step.id)
      }
    }
    for (const target of [...step.tourTargets, ...(step.replayTargets ?? [])]) {
      if (!TOUR_TARGET.test(target)) problems.push(`tour step "${step.id}": tour target "${target}" must match ${TOUR_TARGET.source}`)
    }
  }
  if (checklistIds.size + ids.size > GUIDE_MAX_STEPS) {
    problems.push(`more than ${GUIDE_MAX_STEPS} checklist and tour steps together`)
  }
  return problems
}

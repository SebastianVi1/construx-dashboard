import { canPerform, type MyAccess } from '../permissions/can'
import { hasPermission } from '../permissions/landing'
import { guideCatalog, type GuideCatalog, type GuideGrant, type GuideSectionEntry, type GuideStepEntry } from './catalog'
import type { GuideProgress, GuideStepStatus } from './guideApi'

/** A section the member sees, with its visible steps in display order. */
export type GuideSection = {
  id: string
  titleKey: GuideSectionEntry['titleKey']
  steps: GuideStepEntry[]
}

function grants(access: MyAccess, required: GuideGrant[]): boolean {
  return required.every(({ action, scope }) =>
    scope === 'organization' ? canPerform(access, action) : hasPermission(access, action),
  )
}

/**
 * The member's checklist, chosen from their permissions and never from role
 * codes. Sections follow their `order`; a section shows when its rule passes,
 * and a step when its `requires` pass, under the first visible section that
 * lists it. Sections left with no step are dropped.
 */
export function selectGuide(access: MyAccess | null, catalog: GuideCatalog = guideCatalog): GuideSection[] {
  if (!access) return []
  const qualifies = new Map(catalog.sections.map((section) => [section.id, grants(access, section.rule.requires)]))
  const visible = catalog.sections
    .filter((section) => qualifies.get(section.id) && !(section.rule.unless ?? []).some((id) => qualifies.get(id)))
    .toSorted((a, b) => a.order - b.order)

  const placed = new Set<string>()
  const steps = catalog.steps.filter((step) => grants(access, step.requires))
  const sections: GuideSection[] = []
  for (const section of visible) {
    const own = steps.filter((step) => !placed.has(step.id) && firstVisibleSection(step, visible) === section.id)
    for (const step of own) placed.add(step.id)
    if (own.length > 0) sections.push({ id: section.id, titleKey: section.titleKey, steps: own })
  }
  return sections
}

/** The visible section, by display order, that a step shows under. */
function firstVisibleSection(step: GuideStepEntry, visible: GuideSectionEntry[]): string | undefined {
  return visible.find((section) => step.sections.includes(section.id))?.id
}

export type GuideCount = {
  /** Visible steps completed or skipped. */
  done: number
  /** Visible steps. */
  total: number
  /** Every visible step is done (false when there are none). */
  complete: boolean
  /** First visible step still open, in display order. */
  next: GuideStepEntry | null
}

/** Status of one step, or null while it is open. */
export function stepStatus(progress: GuideProgress | null, stepId: string): GuideStepStatus | null {
  return progress && Object.hasOwn(progress.steps, stepId) ? progress.steps[stepId] : null
}

/**
 * The hint under a step, if any: its `noSiteHint` while the step is open and
 * the member is known to be on no Site (`hasSites` is null until a page has
 * loaded their Sites).
 */
export function stepHint(
  step: GuideStepEntry,
  status: GuideStepStatus | null,
  hasSites: boolean | null,
): NonNullable<GuideStepEntry['noSiteHint']> | null {
  return step.noSiteHint && status === null && hasSites === false ? step.noSiteHint : null
}

/** Progress over the steps the member sees; stored ids of hidden or retired steps don't count. */
export function guideProgressOf(sections: GuideSection[], progress: GuideProgress | null): GuideCount {
  const steps = sections.flatMap((section) => section.steps)
  const open = steps.filter((step) => stepStatus(progress, step.id) === null)
  const done = steps.length - open.length
  return { done, total: steps.length, complete: steps.length > 0 && open.length === 0, next: open[0] ?? null }
}

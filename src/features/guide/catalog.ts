import type { PermissionAction } from '../permissions/can'
import type { guideMessages } from './messages'

/**
 * The lists the getting-started guide is built from. A new section, step or
 * page is only new entries here (plus its text in `messages.ts`); selection,
 * progress and the UI read these lists and never name an id themselves.
 * `catalogProblems` (run by the tests) checks that the entries fit together.
 */

/**
 * One permission a rule needs. `organization` means a company-wide grant;
 * `any` accepts any scope (a grant on assigned sites or own tasks counts).
 */
export type GuideGrant = { action: PermissionAction; scope: 'organization' | 'any' }

/** Who sees a section: every grant in `requires`, and none of the sections named in `unless`. */
export type GuideSectionRule = {
  requires: GuideGrant[]
  /** Section ids; a member who meets the `requires` of any of them doesn't see this section. */
  unless?: string[]
}

export type GuideSectionEntry = {
  id: string
  /** Display position; lower comes first. A step shared by two sections shows in the first one only. */
  order: number
  rule: GuideSectionRule
  /** Heading, from `messages.guide.sections`. */
  titleKey: keyof typeof guideMessages.en.sections
}

/** Chapter anchors of the landing page's long-form guide (`/guia#…`, `/en/guide#…`). */
export type GuideChapter = 'start' | 'sites' | 'company' | 'tasks' | 'finance'

export type GuideStepEntry = {
  /** Stored on the server: must match `^[a-z][a-z0-9-]{0,63}$` and never change once shipped. */
  id: string
  /** Section ids, in preference order; the step shows under the first visible one. */
  sections: string[]
  /** Every grant the member needs to do the step; otherwise the step is hidden and not counted. */
  requires: GuideGrant[]
  /** Id of the page (in `pages`) where the step is done. */
  page: string
  /** Landing-guide chapter that explains the step in depth. */
  chapter: GuideChapter
  /** `data-tour` attribute values on the step's page, highlighted in this order. */
  tourTargets: string[]
  /** Title and body, from `messages.guide.steps`. */
  textKey: keyof typeof guideMessages.en.steps
}

export type GuidePageEntry = {
  id: string
  /** App route. A route under a Site uses the `:siteId` placeholder. */
  route: string
  /** The route is inside one Site, so the guide needs a Site to open it. */
  needsSite: boolean
}

export type GuideCatalog = {
  sections: GuideSectionEntry[]
  steps: GuideStepEntry[]
  pages: GuidePageEntry[]
}

export const guideSections: GuideSectionEntry[] = [
  {
    id: 'owner',
    order: 10,
    rule: {
      requires: [
        { action: 'MANAGE_MEMBERS', scope: 'organization' },
        { action: 'MANAGE_PROJECT', scope: 'organization' },
      ],
    },
    titleKey: 'runCompany',
  },
]

/** Within a section, steps keep this list's order. */
export const guideSteps: GuideStepEntry[] = [
  {
    id: 'create-site',
    sections: ['owner'],
    requires: [{ action: 'MANAGE_PROJECT', scope: 'organization' }],
    page: 'sites',
    chapter: 'sites',
    tourTargets: ['site-create'],
    textKey: 'createSite',
  },
  {
    id: 'site-details',
    sections: ['owner'],
    requires: [{ action: 'MANAGE_PROJECT', scope: 'any' }],
    page: 'site-details',
    chapter: 'sites',
    tourTargets: ['site-details-form'],
    textKey: 'siteDetails',
  },
  {
    id: 'invite-member',
    sections: ['owner'],
    requires: [{ action: 'MANAGE_MEMBERS', scope: 'any' }],
    page: 'members',
    chapter: 'company',
    tourTargets: ['member-invite'],
    textKey: 'inviteMember',
  },
  {
    id: 'site-team',
    sections: ['owner'],
    // The member picker needs MANAGE_MEMBERS; the add form shows with MANAGE_PROJECT on the Site.
    requires: [
      { action: 'MANAGE_MEMBERS', scope: 'any' },
      { action: 'MANAGE_PROJECT', scope: 'any' },
    ],
    page: 'site-details',
    chapter: 'company',
    tourTargets: ['site-team'],
    textKey: 'siteTeam',
  },
  {
    id: 'create-phase',
    sections: ['owner'],
    requires: [{ action: 'MANAGE_GOAL', scope: 'any' }],
    page: 'phases',
    chapter: 'tasks',
    tourTargets: ['phase-create'],
    textKey: 'createPhase',
  },
  {
    id: 'assign-task',
    sections: ['owner'],
    requires: [
      { action: 'MANAGE_ACTIVITY', scope: 'any' },
      { action: 'ASSIGN_ACTIVITY', scope: 'any' },
    ],
    page: 'phases',
    chapter: 'tasks',
    tourTargets: ['task-create'],
    textKey: 'assignTask',
  },
]

export const guidePages: GuidePageEntry[] = [
  { id: 'sites', route: '/sites', needsSite: false },
  { id: 'site-details', route: '/sites/:siteId?tab=details', needsSite: true },
  { id: 'members', route: '/members', needsSite: false },
  { id: 'phases', route: '/sites/:siteId/phases', needsSite: true },
]

export const guideCatalog: GuideCatalog = { sections: guideSections, steps: guideSteps, pages: guidePages }

/** Same rule as the backend (`GUIDE_STEP_INVALID`). */
export const GUIDE_STEP_ID = /^[a-z][a-z0-9-]{0,63}$/

/** A `data-tour` value: a plain id, so it drops into a CSS attribute selector as is. */
export const TOUR_TARGET = /^[a-z][a-z0-9-]*$/

/** The backend keeps at most this many steps per member (`GUIDE_TOO_MANY_STEPS`). */
export const GUIDE_MAX_STEPS = 50

/** Mistakes in a catalog, one sentence each; empty when every entry fits. */
export function catalogProblems(catalog: GuideCatalog): string[] {
  const problems: string[] = []
  const sectionIds = new Set<string>()
  for (const section of catalog.sections) {
    if (sectionIds.has(section.id)) problems.push(`section "${section.id}": duplicate id`)
    sectionIds.add(section.id)
  }
  for (const section of catalog.sections) {
    for (const other of section.rule.unless ?? []) {
      if (!sectionIds.has(other)) problems.push(`section "${section.id}": unknown section "${other}" in unless`)
    }
  }
  const pageIds = new Set(catalog.pages.map((page) => page.id))
  for (const page of catalog.pages) {
    const hasSite = page.route.includes(':siteId')
    if (hasSite && !page.needsSite) problems.push(`page "${page.id}": a route with :siteId must set needsSite`)
    if (!hasSite && page.needsSite) problems.push(`page "${page.id}": needsSite without :siteId in the route`)
  }
  const stepIds = new Set<string>()
  for (const step of catalog.steps) {
    if (!GUIDE_STEP_ID.test(step.id)) problems.push(`step "${step.id}": id must match ${GUIDE_STEP_ID.source}`)
    if (stepIds.has(step.id)) problems.push(`step "${step.id}": duplicate id`)
    stepIds.add(step.id)
    if (step.sections.length === 0) problems.push(`step "${step.id}": belongs to no section`)
    for (const section of step.sections) {
      if (!sectionIds.has(section)) problems.push(`step "${step.id}": unknown section "${section}"`)
    }
    if (!pageIds.has(step.page)) problems.push(`step "${step.id}": unknown page "${step.page}"`)
    for (const target of step.tourTargets) {
      if (!TOUR_TARGET.test(target)) problems.push(`step "${step.id}": tour target "${target}" must match ${TOUR_TARGET.source}`)
    }
  }
  if (stepIds.size > GUIDE_MAX_STEPS) problems.push(`more than ${GUIDE_MAX_STEPS} steps`)
  return problems
}

import { describe, expect, it } from 'bun:test'
import {
  catalogProblems,
  guideCatalog,
  type GuideCatalog,
  type GuideIds,
  type GuideSectionEntry,
  type GuideStepEntry,
} from '../../../features/guide/catalog'
import { guideProgressOf, selectGuide, stepHint, type GuideSection } from '../../../features/guide/selection'
import type { GuideProgress } from '../../../features/guide/guideApi'
import { acceptsMark } from '../../../features/guide/guideState'
import { accessOf, seededRoles } from '../../support/seededRoles'

/** Sections and their step ids, in display order. */
function shape(sections: readonly GuideSection<GuideIds>[]): [string, string[]][] {
  return sections.map((section) => [section.id, section.steps.map((step) => step.id)])
}

function progress(steps: GuideProgress['steps']): GuideProgress {
  return { started: true, steps, dismissedAt: null, updatedAt: '2026-11-21T09:00:00Z' }
}

describe('built-in catalog', () => {
  it('is consistent: known sections and pages, valid unique step ids', () => {
    expect(catalogProblems(guideCatalog)).toEqual([])
  })

  it('reports a step that names an unknown section or page, or has an id the server rejects', () => {
    const broken: GuideCatalog<GuideIds> = {
      ...guideCatalog,
      steps: [
        ...guideCatalog.steps,
        { ...guideCatalog.steps[0], id: 'Bad_Id' },
        { ...guideCatalog.steps[0], id: 'orphan', sections: ['nowhere'], page: 'nowhere' },
      ],
    }
    expect(catalogProblems(broken)).toEqual([
      'step "Bad_Id": id must match ^[a-z][a-z0-9-]{0,63}$',
      'step "orphan": unknown section "nowhere"',
      'step "orphan": unknown page "nowhere"',
    ])
  })
})

/** "Run your company", in the order ticket #87 sets. */
const runCompany = ['create-site', 'site-details', 'invite-member', 'site-team', 'create-phase', 'assign-task']

describe('selectGuide over the built-in roles', () => {
  it('gives the Owner "Run your company" with its six steps in order, then "Finance"', () => {
    expect(shape(selectGuide(seededRoles.OWNER))).toEqual([
      ['owner', runCompany],
      ['finance', ['site-budget', 'record-expense', 'view-finance']],
    ])
  })

  it('gives the Administrator the same "Run your company" as the Owner, but not "Finance": it has no MANAGE_BUDGET', () => {
    expect(shape(selectGuide(seededRoles.ADMINISTRATOR))).toEqual([['owner', runCompany]])
  })

  it('gives the Finance role only "Finance": set a site budget, record an expense, review company finance', () => {
    expect(shape(selectGuide(seededRoles.FINANCE))).toEqual([['finance', ['site-budget', 'record-expense', 'view-finance']]])
  })

  it('gives the Owner the same three Finance steps', () => {
    expect(shape(selectGuide(seededRoles.OWNER))[1]).toEqual(['finance', ['site-budget', 'record-expense', 'view-finance']])
  })

  it('gives "Finance" only with MANAGE_BUDGET company-wide, whatever the role is called', () => {
    expect(shape(selectGuide(accessOf('BOOKKEEPER', 'VIEW_BUDGET:ORGANIZATION,MANAGE_BUDGET:ORGANIZATION')))).toEqual([
      ['finance', ['site-budget', 'record-expense', 'view-finance']],
    ])
    expect(selectGuide(accessOf('BOOKKEEPER', 'VIEW_BUDGET:ORGANIZATION,MANAGE_BUDGET:PROJECT'))).toEqual([])
  })

  it('leaves out "Review company finance" without VIEW_BUDGET company-wide', () => {
    expect(shape(selectGuide(accessOf('BUYER', 'VIEW_BUDGET:PROJECT,MANAGE_BUDGET:ORGANIZATION')))).toEqual([
      ['finance', ['site-budget', 'record-expense']],
    ])
  })

  it('gives no section to roles with neither the owner nor the finance grants company-wide', () => {
    for (const role of ['MEMBER', 'WORKER', 'RESIDENT', 'SITE_MANAGER', 'SUPERINTENDENT'] as const) {
      expect([role, shape(selectGuide(seededRoles[role])).filter(([id]) => id === 'owner' || id === 'finance')]).toEqual([role, []])
    }
  })

  it('gives nothing while permissions are unknown', () => {
    expect(selectGuide(null)).toEqual([])
  })

  it('reads permissions, not role codes: a custom role with the grants gets the section', () => {
    const custom = accessOf('CUSTOM_LEAD', 'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:ORGANIZATION')
    expect(shape(selectGuide(custom))).toEqual([['owner', ['create-site', 'site-details', 'invite-member', 'site-team']]])
  })

  it('leaves out the steps a custom role cannot do: planning without ASSIGN_ACTIVITY keeps the phase, drops the task', () => {
    const custom = accessOf(
      'CUSTOM_LEAD',
      'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:ORGANIZATION,MANAGE_GOAL:ORGANIZATION,MANAGE_ACTIVITY:ORGANIZATION',
    )
    expect(shape(selectGuide(custom))).toEqual([
      ['owner', ['create-site', 'site-details', 'invite-member', 'site-team', 'create-phase']],
    ])
  })

  it('needs the organization scope: MANAGE_PROJECT on assigned sites only is not enough', () => {
    const custom = accessOf('CUSTOM_LEAD', 'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:PROJECT')
    expect(selectGuide(custom)).toEqual([])
  })

  it('carries each section title key for the panel', () => {
    expect(selectGuide(seededRoles.OWNER)[0].titleKey).toBe('runCompany')
  })
})

/** "Manage your sites" for a role that may edit its Sites' details, in the order ticket #89 sets. */
const manageSites = ['open-site', 'site-details', 'create-phase', 'assign-task']
/** The same without "Complete the site's details": no MANAGE_PROJECT. */
const manageSitesNoDetails = ['open-site', 'create-phase', 'assign-task']

describe('selectGuide: "Manage your sites"', () => {
  it('gives the Site Manager its four steps, opening its site first', () => {
    expect(shape(selectGuide(seededRoles.SITE_MANAGER))).toEqual([['siteManager', manageSites]])
  })

  it('leaves out "Complete the site\'s details" for the Resident and the Superintendent: no MANAGE_PROJECT', () => {
    expect(shape(selectGuide(seededRoles.RESIDENT))).toEqual([['siteManager', manageSitesNoDetails]])
    expect(shape(selectGuide(seededRoles.SUPERINTENDENT))).toEqual([['siteManager', manageSitesNoDetails]])
  })

  it('gives it to the Member too: it manages phases and assigns tasks company-wide', () => {
    expect(shape(selectGuide(seededRoles.MEMBER))).toEqual([['siteManager', manageSitesNoDetails]])
  })

  it('gives the Worker nothing: it can only update its own tasks', () => {
    expect(selectGuide(seededRoles.WORKER)).toEqual([])
  })

  it('is not shown to roles that already get "Run your company"', () => {
    expect(shape(selectGuide(seededRoles.OWNER)).map(([id]) => id)).toEqual(['owner', 'finance'])
    expect(shape(selectGuide(seededRoles.ADMINISTRATOR)).map(([id]) => id)).toEqual(['owner'])
  })

  it('needs both MANAGE_GOAL and ASSIGN_ACTIVITY', () => {
    expect(selectGuide(accessOf('PLANNER', 'VIEW_PROJECT:PROJECT,MANAGE_GOAL:PROJECT'))).toEqual([])
    expect(selectGuide(accessOf('DISPATCHER', 'VIEW_PROJECT:PROJECT,MANAGE_ACTIVITY:PROJECT,ASSIGN_ACTIVITY:PROJECT'))).toEqual([])
  })

  it('lists a custom role with owner and site-manager grants under "Run your company" only, each step once', () => {
    const mixed = accessOf(
      'CUSTOM_MIXED',
      'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:ORGANIZATION,VIEW_PROJECT:ORGANIZATION,' +
        'MANAGE_GOAL:PROJECT,MANAGE_ACTIVITY:PROJECT,ASSIGN_ACTIVITY:PROJECT',
    )
    expect(shape(selectGuide(mixed))).toEqual([['owner', runCompany]])
  })

  it('puts a custom role with site-manager and finance grants under both, "Manage your sites" first', () => {
    const mixed = accessOf(
      'CUSTOM_SITE_FINANCE',
      'VIEW_PROJECT:PROJECT,MANAGE_PROJECT:PROJECT,MANAGE_GOAL:PROJECT,MANAGE_ACTIVITY:PROJECT,' +
        'ASSIGN_ACTIVITY:PROJECT,VIEW_BUDGET:ORGANIZATION,MANAGE_BUDGET:ORGANIZATION',
    )
    expect(shape(selectGuide(mixed))).toEqual([
      ['siteManager', manageSites],
      ['finance', ['site-budget', 'record-expense', 'view-finance']],
    ])
  })

  it('carries its title key for the panel', () => {
    expect(selectGuide(seededRoles.SITE_MANAGER)[0].titleKey).toBe('manageSites')
  })
})

describe('stepHint', () => {
  const [openSite, siteDetails] = selectGuide(seededRoles.SITE_MANAGER)[0].steps

  it('asks a member on no Site to go to their administrator, under the open "Open your site"', () => {
    expect(openSite.id).toBe('open-site')
    expect(stepHint(openSite, null, false)).toBe('askAdmin')
  })

  it('stays quiet while the Sites are unknown or the member has some', () => {
    expect(stepHint(openSite, null, null)).toBeNull()
    expect(stepHint(openSite, null, true)).toBeNull()
  })

  it('stays quiet once the step is done or skipped', () => {
    expect(stepHint(openSite, 'COMPLETED', false)).toBeNull()
    expect(stepHint(openSite, 'SKIPPED', false)).toBeNull()
  })

  it('never shows under a step without a hint', () => {
    expect(stepHint(siteDetails, null, false)).toBeNull()
  })
})

/**
 * A test-only section and steps added purely as list entries: they must flow
 * through selection and progress with no change to the guide's core code.
 */
describe('a section added only as list entries', () => {
  const planning: GuideSectionEntry<GuideIds> = {
    id: 'planning',
    order: 20,
    rule: { requires: [{ action: 'VIEW_PLAN', scope: 'any' }] },
    titleKey: 'runCompany',
  }
  const early: GuideSectionEntry<GuideIds> = {
    id: 'early',
    order: 5,
    rule: { requires: [{ action: 'VIEW_PLAN', scope: 'organization' }] },
    titleKey: 'runCompany',
  }
  const notForOwners: GuideSectionEntry<GuideIds> = {
    id: 'not-for-owners',
    order: 30,
    rule: { requires: [{ action: 'VIEW_PROJECT', scope: 'any' }], unless: ['owner'] },
    titleKey: 'runCompany',
  }
  const base = guideCatalog.steps[0]
  type TestStep = GuideStepEntry<GuideIds>
  const step = (entry: Partial<TestStep> & Pick<TestStep, 'id' | 'sections'>): TestStep => ({
    ...base,
    requires: [],
    tourTargets: [],
    ...entry,
  })
  // Only the first built-in section and step, so new built-in entries don't change these expectations.
  const catalog: GuideCatalog<GuideIds> = {
    sections: [guideCatalog.sections[0], planning, early, notForOwners],
    steps: [
      base,
      step({ id: 'open-plan', sections: ['owner', 'planning'], requires: [{ action: 'VIEW_PLAN', scope: 'any' }] }),
      step({ id: 'draw-zone', sections: ['planning'], requires: [{ action: 'MANAGE_PLAN', scope: 'any' }] }),
      step({ id: 'early-step', sections: ['early'] }),
      step({ id: 'look-around', sections: ['not-for-owners'] }),
    ],
    pages: guideCatalog.pages,
  }

  it('is consistent', () => {
    expect(catalogProblems(catalog)).toEqual([])
  })

  it('orders sections by their order, not by list position', () => {
    expect(shape(selectGuide(seededRoles.OWNER, catalog)).map(([id]) => id)).toEqual(['early', 'owner', 'planning'])
  })

  it('lists a shared step once, in the first section that has it', () => {
    expect(shape(selectGuide(seededRoles.OWNER, catalog))).toEqual([
      ['early', ['early-step']],
      ['owner', ['create-site', 'open-plan']],
      ['planning', ['draw-zone']],
    ])
  })

  it('drops steps whose requirements fail, and sections left with no step', () => {
    const viewer = accessOf('VIEWER', 'VIEW_PLAN:PROJECT')
    expect(shape(selectGuide(viewer, catalog))).toEqual([['planning', ['open-plan']]])
  })

  it('hides a section from members who meet the rule of a section it names under "unless"', () => {
    expect(shape(selectGuide(seededRoles.WORKER, catalog))).toEqual([
      ['planning', ['open-plan']],
      ['not-for-owners', ['look-around']],
    ])
    expect(shape(selectGuide(seededRoles.ADMINISTRATOR, catalog)).map(([id]) => id)).not.toContain('not-for-owners')
  })

  it('accepts marks for its steps like any built-in step', () => {
    const sections = selectGuide(seededRoles.WORKER, catalog)
    expect(acceptsMark(sections, progress({}), 'open-plan', 'COMPLETED')).toBe(true)
    expect(acceptsMark(sections, progress({}), 'draw-zone', 'COMPLETED')).toBe(false)
  })

  it('counts its steps in progress like any built-in step', () => {
    const sections = selectGuide(seededRoles.WORKER, catalog)
    const counted = guideProgressOf(sections, progress({ 'open-plan': 'COMPLETED' }))
    expect(counted.done).toBe(1)
    expect(counted.total).toBe(2)
    expect(counted.next?.id).toBe('look-around')
  })
})

describe('guideProgressOf', () => {
  const ownerSections: GuideSection[] = [{ id: 'owner', titleKey: 'runCompany', steps: [guideCatalog.steps[0]] }]

  it('starts at zero with no progress loaded', () => {
    expect(guideProgressOf(ownerSections, null)).toEqual({
      done: 0,
      total: 1,
      complete: false,
      next: guideCatalog.steps[0],
    })
  })

  it('counts completed and skipped steps the member can see', () => {
    expect(guideProgressOf(ownerSections, progress({ 'create-site': 'SKIPPED' }))).toMatchObject({
      done: 1,
      total: 1,
      complete: true,
      next: null,
    })
  })

  it('ignores stored ids that are unknown or hidden from the member', () => {
    const stored = progress({ 'old-step': 'COMPLETED', 'create-site': 'COMPLETED' })
    expect(guideProgressOf([], stored)).toEqual({ done: 0, total: 0, complete: false, next: null })
    expect(guideProgressOf(ownerSections, progress({ 'old-step': 'COMPLETED' }))).toMatchObject({ done: 0, total: 1 })
  })
})

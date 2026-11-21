import { describe, expect, it } from 'bun:test'
import {
  catalogProblems,
  guideCatalog,
  type GuideCatalog,
  type GuideSectionEntry,
  type GuideStepEntry,
} from '../../../features/guide/catalog'
import { guideProgressOf, selectGuide, type GuideSection } from '../../../features/guide/selection'
import type { GuideProgress } from '../../../features/guide/guideApi'
import { acceptsMark } from '../../../features/guide/guideState'
import { accessOf, seededRoles } from '../../support/seededRoles'

/** Sections and their step ids, in display order. */
function shape(sections: GuideSection[]): [string, string[]][] {
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
    const broken: GuideCatalog = {
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

describe('selectGuide over the built-in roles', () => {
  it('gives the Owner "Run your company" with "Create your first site"', () => {
    expect(shape(selectGuide(seededRoles.OWNER))).toEqual([['owner', ['create-site']]])
  })

  it('gives the Administrator the same section as the Owner', () => {
    expect(shape(selectGuide(seededRoles.ADMINISTRATOR))).toEqual([['owner', ['create-site']]])
  })

  it('gives no section to roles without MANAGE_MEMBERS and MANAGE_PROJECT company-wide', () => {
    for (const role of ['MEMBER', 'WORKER', 'FINANCE', 'RESIDENT', 'SITE_MANAGER', 'SUPERINTENDENT'] as const) {
      expect([role, shape(selectGuide(seededRoles[role]))]).toEqual([role, []])
    }
  })

  it('gives nothing while permissions are unknown', () => {
    expect(selectGuide(null)).toEqual([])
  })

  it('reads permissions, not role codes: a custom role with the grants gets the section', () => {
    const custom = accessOf('CUSTOM_LEAD', 'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:ORGANIZATION')
    expect(shape(selectGuide(custom))).toEqual([['owner', ['create-site']]])
  })

  it('needs the organization scope: MANAGE_PROJECT on assigned sites only is not enough', () => {
    const custom = accessOf('CUSTOM_LEAD', 'MANAGE_MEMBERS:ORGANIZATION,MANAGE_PROJECT:PROJECT')
    expect(selectGuide(custom)).toEqual([])
  })

  it('carries each section title key for the panel', () => {
    expect(selectGuide(seededRoles.OWNER)[0].titleKey).toBe('runCompany')
  })
})

/**
 * A test-only section and steps added purely as list entries: they must flow
 * through selection and progress with no change to the guide's core code.
 */
describe('a section added only as list entries', () => {
  const planning: GuideSectionEntry = {
    id: 'planning',
    order: 20,
    rule: { requires: [{ action: 'VIEW_PLAN', scope: 'any' }] },
    titleKey: 'runCompany',
  }
  const early: GuideSectionEntry = {
    id: 'early',
    order: 5,
    rule: { requires: [{ action: 'VIEW_PLAN', scope: 'organization' }] },
    titleKey: 'runCompany',
  }
  const notForOwners: GuideSectionEntry = {
    id: 'not-for-owners',
    order: 30,
    rule: { requires: [{ action: 'VIEW_PROJECT', scope: 'any' }], unless: ['owner'] },
    titleKey: 'runCompany',
  }
  const base = guideCatalog.steps[0]
  const step = (entry: Partial<GuideStepEntry> & Pick<GuideStepEntry, 'id' | 'sections'>): GuideStepEntry => ({
    ...base,
    requires: [],
    tourTargets: [],
    ...entry,
  })
  const catalog: GuideCatalog = {
    sections: [...guideCatalog.sections, planning, early, notForOwners],
    steps: [
      ...guideCatalog.steps,
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
  const ownerSections = selectGuide(seededRoles.OWNER)

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

import { describe, expect, it } from 'bun:test'
import {
  catalogProblems,
  guideCatalog,
  type GuideCatalog,
  type GuidePageEntry,
  type GuideStepEntry,
} from '../../../features/guide/catalog'
import { guidePath, siteIdInPath, stepsOnPage } from '../../../features/guide/guidePaths'
import type { GuideSection } from '../../../features/guide/selection'

const pages: GuidePageEntry[] = [
  { id: 'sites', route: '/sites', needsSite: false },
  { id: 'members', route: '/members', needsSite: false },
  { id: 'site-details', route: '/sites/:siteId?tab=details', needsSite: true },
  { id: 'phases', route: '/sites/:siteId/phases', needsSite: true },
]

describe('guidePath', () => {
  it('opens a Company page as it is, with or without a known Site', () => {
    expect(guidePath('sites', null, pages)).toEqual({ path: '/sites', needsSite: false })
    expect(guidePath('members', 's1', pages)).toEqual({ path: '/members', needsSite: false })
  })

  it('opens a Site page in the remembered Site, keeping its query', () => {
    expect(guidePath('site-details', 's1', pages)).toEqual({ path: '/sites/s1?tab=details', needsSite: false })
    expect(guidePath('phases', 'a b/c', pages)).toEqual({ path: '/sites/a%20b%2Fc/phases', needsSite: false })
  })

  it('falls back to the Sites list when a Site page has no Site to open', () => {
    expect(guidePath('phases', null, pages)).toEqual({ path: '/sites', needsSite: true })
  })

  it('knows nothing about a page that is not in the list', () => {
    expect(guidePath('nowhere', 's1', pages)).toBeNull()
  })
})

describe('catalogProblems on pages and tour targets', () => {
  it('reports a Site route that does not say it needs a Site, and the reverse', () => {
    const catalog: GuideCatalog = {
      ...guideCatalog,
      pages: [
        ...guideCatalog.pages,
        { id: 'phases', route: '/sites/:siteId/phases', needsSite: false },
        { id: 'team', route: '/members', needsSite: true },
      ],
    }
    expect(catalogProblems(catalog)).toEqual([
      'page "phases": a route with :siteId must set needsSite',
      'page "team": needsSite without :siteId in the route',
    ])
  })

  it('reports a tour target that is not a plain id', () => {
    const catalog: GuideCatalog = {
      ...guideCatalog,
      steps: [{ ...guideCatalog.steps[0], tourTargets: ['site-create', 'New site"]'] }],
    }
    expect(catalogProblems(catalog)).toEqual([
      'step "create-site": tour target "New site"]" must match ^[a-z][a-z0-9-]*$',
    ])
  })
})

describe('stepsOnPage', () => {
  const step = (id: string, page: string): GuideStepEntry => ({
    id,
    sections: ['owner'],
    requires: [],
    page,
    chapter: 'sites',
    tourTargets: [id],
    textKey: 'createSite',
  })
  const sections: GuideSection[] = [
    { id: 'owner', titleKey: 'runCompany', steps: [step('create-site', 'sites'), step('invite-member', 'members')] },
    { id: 'finance', titleKey: 'runCompany', steps: [step('open-site', 'sites')] },
  ]

  it('lists the member\'s steps on a page in checklist order, across sections', () => {
    expect(stepsOnPage(sections, 'sites').map((entry) => entry.id)).toEqual(['create-site', 'open-site'])
  })

  it('is empty for a page where the member has no step', () => {
    expect(stepsOnPage(sections, 'finance')).toEqual([])
    expect(stepsOnPage([], 'sites')).toEqual([])
  })
})

describe('siteIdInPath', () => {
  it('reads the Site from any page inside a Site', () => {
    expect(siteIdInPath('/sites/s1')).toBe('s1')
    expect(siteIdInPath('/sites/s1/phases/g1/tasks/t1')).toBe('s1')
    expect(siteIdInPath('/documents/sites/a%20b/folders/f1')).toBe('a b')
  })

  it('finds no Site on Company pages', () => {
    expect(siteIdInPath('/sites')).toBeNull()
    expect(siteIdInPath('/sites/')).toBeNull()
    expect(siteIdInPath('/members')).toBeNull()
    expect(siteIdInPath('/')).toBeNull()
  })

  it('ignores a Site id that is not valid URL encoding', () => {
    expect(siteIdInPath('/sites/%E0%A4%A')).toBeNull()
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { subscribeGuideSites, subscribeGuideSteps, type GuideMark, type GuideSitesReport } from '../../../features/guide/guideEvents'
import { loadOpenSites, loadSite } from '../../../features/sites/siteLoad'
import type { Site } from '../../../features/sites/sitesApi'

let marks: GuideMark[] = []
let reports: GuideSitesReport[] = []
let stops = listen()

function listen() {
  return [subscribeGuideSteps((mark) => marks.push(mark)), subscribeGuideSites((report) => reports.push(report))]
}

afterEach(() => {
  for (const stop of stops) stop()
  marks = []
  reports = []
  stops = listen()
})

const site = { id: 'site-1', name: 'Torre Norte' } as Site

describe('loadSite', () => {
  it('returns the Site and ticks "Open your site" in its Company once it loaded', async () => {
    const asked: string[][] = []
    const loaded = await loadSite('org-1', 'site-1', async (organizationId, siteId) => {
      asked.push([organizationId, siteId])
      return site
    })
    expect(loaded).toBe(site)
    expect(asked).toEqual([['org-1', 'site-1']])
    expect(marks).toEqual([{ stepId: 'open-site', organizationId: 'org-1' }])
  })

  it('does not tick the step when the Site fails to load, and passes the error on', async () => {
    const failure = new Error('404')
    await expect(
      loadSite('org-1', 'site-1', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})

describe('loadOpenSites', () => {
  it('returns the open Sites and tells the guide the member has some', async () => {
    const asked: string[] = []
    const loaded = await loadOpenSites('org-1', async (organizationId) => {
      asked.push(organizationId)
      return [site]
    })
    expect(loaded).toEqual([site])
    expect(asked).toEqual(['org-1'])
    expect(reports).toEqual([{ organizationId: 'org-1', hasSites: true }])
  })

  it('tells the guide the member is on no Site when the list is empty', async () => {
    await loadOpenSites('org-1', async () => [])
    expect(reports).toEqual([{ organizationId: 'org-1', hasSites: false }])
  })

  it('tells the guide nothing when the list fails to load, and passes the error on', async () => {
    const failure = new Error('500')
    await expect(
      loadOpenSites('org-1', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(reports).toEqual([])
  })
})

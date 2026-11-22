import { markGuideStep, reportGuideSites } from '../guide/guideEvents'
import { getSite, listSites, type Site } from './sitesApi'

/**
 * One Site, for any page inside it (details, phases, documents, attendance).
 * Once it loaded, the guide's "Open your site" step ticks off; a failed load
 * doesn't. Pages call this, never `getSite`, so every Site page counts.
 */
export async function loadSite(organizationId: string, siteId: string, load: typeof getSite = getSite): Promise<Site> {
  const site = await load(organizationId, siteId)
  markGuideStep('open-site', organizationId)
  return site
}

/**
 * The open Sites the member sees in a Company. Once the list loaded, the guide
 * learns whether it is empty, so it can tell a member on no Site to ask their
 * administrator.
 */
export async function loadOpenSites(organizationId: string, load: typeof listSites = listSites): Promise<Site[]> {
  const sites = await load(organizationId)
  reportGuideSites(organizationId, sites.length > 0)
  return sites
}

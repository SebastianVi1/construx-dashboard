import { markGuideStep } from '../guide'
import {
  assignToSite,
  createSite,
  updateSite,
  type Site,
  type SiteAccess,
  type SiteDraft,
  type SitePatch,
} from './sitesApi'

/**
 * Create a Site. One that was created ticks the guide's "Create your first
 * site" step (with its id, which the guided tour remembers); a failed create doesn't.
 */
export async function addSite(
  organizationId: string,
  draft: SiteDraft,
  create: typeof createSite = createSite,
): Promise<Site> {
  const site = await create(organizationId, draft)
  markGuideStep('create-site', organizationId, site.id)
  return site
}

/**
 * Save a Site's changed details. An empty patch sends nothing and returns
 * null; a save that went through ticks the guide's "Fill in your site
 * details" step, a failed one doesn't.
 */
export async function saveSiteDetails(
  organizationId: string,
  siteId: string,
  patch: SitePatch,
  update: typeof updateSite = updateSite,
): Promise<Site | null> {
  if (Object.keys(patch).length === 0) return null
  const site = await update(organizationId, siteId, patch)
  markGuideStep('site-details', organizationId)
  return site
}

/**
 * Put a Company member on a Site. A member who was added ticks the guide's
 * "Add people to your site" step; a failed assignment doesn't.
 */
export async function addSitePerson(
  organizationId: string,
  siteId: string,
  membershipId: string,
  assign: typeof assignToSite = assignToSite,
): Promise<SiteAccess> {
  const person = await assign(organizationId, siteId, membershipId)
  markGuideStep('site-team', organizationId)
  return person
}

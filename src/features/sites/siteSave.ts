import { markGuideStep } from '../guide'
import { createSite, updateSite, type Site, type SiteDraft, type SitePatch } from './sitesApi'

/**
 * Create a Site. One that was created ticks the guide's "Create your first
 * site" step; a failed create doesn't.
 */
export async function addSite(
  organizationId: string,
  draft: SiteDraft,
  create: typeof createSite = createSite,
): Promise<Site> {
  const site = await create(organizationId, draft)
  markGuideStep('create-site', organizationId)
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

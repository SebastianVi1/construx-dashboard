import { markGuideStep } from '../guide'
import { createSite, type Site, type SiteDraft } from './sitesApi'

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

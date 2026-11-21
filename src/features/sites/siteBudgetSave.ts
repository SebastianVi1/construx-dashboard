import { markGuideStep } from '../guide/guideEvents'
import { setSiteBudget, type Site } from './sitesApi'

/**
 * Save a Site's budget, or remove it with null. A budget that saved ticks the
 * guide's "Set a site budget" step; a removal or a failed save doesn't.
 */
export async function saveSiteBudget(
  organizationId: string,
  siteId: string,
  amount: number | null,
  save: typeof setSiteBudget = setSiteBudget,
): Promise<Site> {
  const updated = await save(organizationId, siteId, amount)
  if (amount !== null) markGuideStep('site-budget', organizationId)
  return updated
}

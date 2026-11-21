import { markGuideStep } from '../guide/guideEvents'
import { getOrgFinanceSummary, type OrgFinanceSummary } from './orgFinanceApi'

/**
 * The Company Finance page's data. Once it loaded, the guide's "Review company
 * finance" step ticks off; a failed load doesn't.
 */
export async function loadOrgFinanceSummary(
  organizationId: string,
  load: typeof getOrgFinanceSummary = getOrgFinanceSummary,
): Promise<OrgFinanceSummary> {
  const summary = await load(organizationId)
  markGuideStep('view-finance', organizationId)
  return summary
}

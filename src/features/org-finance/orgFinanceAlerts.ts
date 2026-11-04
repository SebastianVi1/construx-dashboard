import type { SiteFinanceStatus } from './orgFinanceApi'

/** Share of the budget (in %) from which a site is flagged as close to its limit. */
export const NEAR_LIMIT_PCT = 80

/**
 * Budget health of a site, mirroring the backend: no budget → NO_BUDGET, above 100% → OVER_BUDGET,
 * from 80% up to 100% → NEAR_LIMIT, otherwise OK. Any spend against a zero budget is an overrun.
 */
export function getSiteStatus(spent: number, budget: number | null): SiteFinanceStatus {
  if (budget === null) return 'NO_BUDGET'
  if (spent > budget) return 'OVER_BUDGET'
  if (budget > 0 && (spent / budget) * 100 >= NEAR_LIMIT_PCT) return 'NEAR_LIMIT'
  return 'OK'
}

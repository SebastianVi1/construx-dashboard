import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureAuthApi } from '../../../features/auth/authApi'
import {
  getMonthlyExpenses,
  getOrgFinanceSummary,
  monthlyExpensesSchema,
  orgFinanceSummarySchema,
} from '../../../features/org-finance/orgFinanceApi'
import { getSiteStatus } from '../../../features/org-finance/orgFinanceAlerts'

const summary = {
  totalBudget: 500000,
  totalSpent: 320000,
  totalRemaining: 180000,
  executionPct: 64,
  sitesOverBudget: 1,
  sitesNearLimit: 2,
  byCategory: [{ category: 'MATERIALS', amount: 180000 }],
  sites: [
    {
      siteId: 'uuid',
      siteName: 'Torre Norte',
      allocatedBudget: 200000,
      spent: 190000,
      remaining: 10000,
      executionPct: 95,
      status: 'NEAR_LIMIT',
    },
  ],
}

const monthly = { totalBudget: 500000, months: [{ month: '2026-01', spent: 42000 }] }

function stubApi(get: (url: string, config?: unknown) => unknown) {
  const client = { get: mock(async (url: string, config?: unknown) => get(url, config)) }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return client
}

describe('orgFinanceSummarySchema', () => {
  it('parses the contract example unchanged', () => {
    expect(orgFinanceSummarySchema.parse(summary)).toEqual(summary as never)
  })

  it('fills missing optional fields with "no data" instead of failing', () => {
    const parsed = orgFinanceSummarySchema.parse({
      totalBudget: 0,
      totalSpent: 1200,
      totalRemaining: 0,
      sites: [{ siteId: 's-2', siteName: 'Bodega', spent: 1200, status: 'NO_BUDGET' }],
    })
    expect(parsed.executionPct).toBeNull()
    expect(parsed.sitesOverBudget).toBe(0)
    expect(parsed.sitesNearLimit).toBe(0)
    expect(parsed.byCategory).toEqual([])
    expect(parsed.sites[0]).toEqual({
      siteId: 's-2',
      siteName: 'Bodega',
      allocatedBudget: null,
      spent: 1200,
      remaining: null,
      executionPct: null,
      status: 'NO_BUDGET',
    })
  })

  it('accepts a negative balance (over budget)', () => {
    expect(orgFinanceSummarySchema.parse({ ...summary, totalRemaining: -5000 }).totalRemaining).toBe(-5000)
  })

  it('rejects an unknown site status and a missing site list', () => {
    const badSite = { ...summary.sites[0], status: 'BROKE' }
    expect(orgFinanceSummarySchema.safeParse({ ...summary, sites: [badSite] }).success).toBe(false)
    const withoutSites: Partial<typeof summary> = { ...summary }
    delete withoutSites.sites
    expect(orgFinanceSummarySchema.safeParse(withoutSites).success).toBe(false)
  })
})

describe('monthlyExpensesSchema', () => {
  it('parses the contract example', () => {
    expect(monthlyExpensesSchema.parse(monthly)).toEqual(monthly)
  })

  it('rejects a month that is not YYYY-MM', () => {
    expect(monthlyExpensesSchema.safeParse({ totalBudget: 1, months: [{ month: '2026-1', spent: 1 }] }).success).toBe(false)
    expect(monthlyExpensesSchema.safeParse({ totalBudget: 1, months: [{ month: '2026-01-01', spent: 1 }] }).success).toBe(false)
  })
})

describe('org finance API', () => {
  afterEach(() => mock.restore())

  it('loads the summary of the organization', async () => {
    const client = stubApi(() => ({ status: 200, data: summary }))
    expect((await getOrgFinanceSummary('org 1')).totalSpent).toBe(320000)
    expect(client.get.mock.calls[0]?.[0]).toBe('/api/organizations/org%201/finance/summary')
  })

  it('loads monthly expenses for the requested period', async () => {
    const client = stubApi(() => ({ status: 200, data: monthly }))
    const result = await getMonthlyExpenses('org-1', { from: '2026-01-01', to: '2026-11-04' })
    expect(result.months).toEqual([{ month: '2026-01', spent: 42000 }])
    expect(client.get.mock.calls[0]?.[0]).toBe(
      '/api/organizations/org-1/finance/expenses/monthly?from=2026-01-01&to=2026-11-04',
    )
  })
})

describe('getSiteStatus', () => {
  it('is NO_BUDGET when the site has no budget', () => {
    expect(getSiteStatus(5000, null)).toBe('NO_BUDGET')
  })

  it('is OK below 80% of the budget', () => {
    expect(getSiteStatus(0, 1000)).toBe('OK')
    expect(getSiteStatus(799.99, 1000)).toBe('OK')
  })

  it('is NEAR_LIMIT from 80% up to exactly 100%', () => {
    expect(getSiteStatus(800, 1000)).toBe('NEAR_LIMIT')
    expect(getSiteStatus(1000, 1000)).toBe('NEAR_LIMIT')
  })

  it('is OVER_BUDGET above 100%', () => {
    expect(getSiteStatus(1000.01, 1000)).toBe('OVER_BUDGET')
    expect(getSiteStatus(1, 0)).toBe('OVER_BUDGET')
  })
})

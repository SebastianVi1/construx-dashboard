import { describe, expect, it } from 'bun:test'
import type { MyAccess } from '../../../features/permissions/can'
import { workspaceNavItems } from '../../../features/organizations/workspaceNav'
import { seesOrgFinance, workspaceHomePath } from '../../../features/org-finance/orgFinanceAccess'
import { burnChartLayout, donutSlices, financePeriod } from '../../../features/org-finance/orgFinanceCharts'

function access(permissions: MyAccess['permissions']): MyAccess {
  return { membershipId: 'm-1', role: { code: 'R', name: 'Role' }, permissions }
}

describe('financePeriod', () => {
  const today = new Date(2026, 10, 4)

  it('defaults to the year in progress for 1Y', () => {
    expect(financePeriod('1Y', today)).toEqual({ from: '2026-01-01', to: '2026-11-04' })
  })

  it('covers the current month and the previous ones for 3M and 6M', () => {
    expect(financePeriod('3M', today)).toEqual({ from: '2026-09-01', to: '2026-11-04' })
    expect(financePeriod('6M', today)).toEqual({ from: '2026-06-01', to: '2026-11-04' })
  })

  it('crosses into the previous year', () => {
    expect(financePeriod('6M', new Date(2026, 1, 10))).toEqual({ from: '2025-09-01', to: '2026-02-10' })
  })
})

describe('burnChartLayout', () => {
  const months = [
    { month: '2026-01', spent: 100000 },
    { month: '2026-02', spent: 0 },
    { month: '2026-03', spent: 150000 },
  ]

  it('scales bars and the running total against the budget ceiling', () => {
    const layout = burnChartLayout(months, 500000)
    expect(layout.max).toBe(500000)
    expect(layout.ceiling).toBe(1)
    expect(layout.points.map((point) => point.bar)).toEqual([0.2, 0, 0.3])
    expect(layout.points.map((point) => point.cumulative)).toEqual([100000, 100000, 250000])
    expect(layout.points.map((point) => point.line)).toEqual([0.2, 0.2, 0.5])
    expect(layout.overBudgetFrom).toBeNull()
  })

  it('raises the scale above the budget and marks the month the budget ran out', () => {
    const layout = burnChartLayout(months, 200000)
    expect(layout.max).toBe(250000)
    expect(layout.ceiling).toBe(0.8)
    expect(layout.overBudgetFrom).toBe('2026-03')
  })

  it('has no ceiling without a budget and no division by zero without spend', () => {
    const layout = burnChartLayout([{ month: '2026-01', spent: 0 }], 0)
    expect(layout.ceiling).toBeNull()
    expect(layout.points[0]).toEqual({ month: '2026-01', spent: 0, cumulative: 0, bar: 0, line: 0 })
  })
})

describe('donutSlices', () => {
  it('keeps the category order, skips empty categories and stacks the shares', () => {
    expect(
      donutSlices([
        { category: 'OTHER', amount: 25 },
        { category: 'MATERIALS', amount: 75 },
        { category: 'LABOR', amount: 0 },
      ]),
    ).toEqual([
      { category: 'MATERIALS', amount: 75, share: 0.75, offset: 0 },
      { category: 'OTHER', amount: 25, share: 0.25, offset: 0.75 },
    ])
  })

  it('is empty when nothing was spent', () => {
    expect(donutSlices([{ category: 'LABOR', amount: 0 }])).toEqual([])
  })
})

describe('org finance access', () => {
  it('requires VIEW_BUDGET company-wide', () => {
    expect(seesOrgFinance(access([{ action: 'VIEW_BUDGET', scope: 'ORGANIZATION' }]))).toBe(true)
    expect(seesOrgFinance(access([{ action: 'VIEW_BUDGET', scope: 'PROJECT' }]))).toBe(false)
    expect(seesOrgFinance(null)).toBe(false)
  })

  it('opens the finance dashboard first when allowed, otherwise the role landing screen', () => {
    expect(workspaceHomePath(access([{ action: 'VIEW_BUDGET', scope: 'ORGANIZATION' }]))).toBe('/finance')
    expect(workspaceHomePath(access([{ action: 'VIEW_PROJECT', scope: 'ORGANIZATION' }]))).toBe('/sites')
    expect(workspaceHomePath(access([{ action: 'MANAGE_ACTIVITY', scope: 'OWN' }]))).toBe('/tasks')
  })
})

describe('workspaceNavItems finance entry', () => {
  const base = { seesOwnTasks: false, seesPrices: false, seesBudget: false, managesMembers: false }

  it('lists finance first when the role sees the company finances', () => {
    expect(workspaceNavItems({ ...base, seesFinance: true }).map((item) => item.to)).toEqual([
      '/finance',
      '/sites',
      '/documents',
    ])
  })

  it('leaves the navigation unchanged otherwise', () => {
    expect(workspaceNavItems(base).map((item) => item.key)).toEqual(['sites', 'documents'])
  })
})

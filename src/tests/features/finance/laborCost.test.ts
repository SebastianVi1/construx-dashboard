import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureHttp } from '../../../lib/http'
import {
  getLaborCost,
  laborRangeIssue,
  listLaborCostDays,
  type LaborCostReport,
} from '../../../features/finance/laborCost'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const site = '/api/organizations/org-1/projects/p-1'

const report: LaborCostReport = {
  from: '2026-03-10',
  to: '2026-03-11',
  total: '1250.00',
  personDays: 3,
  unratedPersonDays: 1,
  people: [
    {
      membershipId: 'm-1',
      fullName: 'Ana Perez',
      days: 2,
      amount: '1250.00',
      unratedDays: 0,
      currentRate: { kind: 'CATALOG', laborCategory: { id: 'r-1', code: 'MO011', name: 'PEON' }, dailyAmount: '650.00' },
    },
    { membershipId: 'm-2', fullName: null, days: 1, amount: '0.00', unratedDays: 1, currentRate: null },
  ],
}

function stubApi(data: unknown) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : { status: 200, data }))
  const client = { get, post: get, patch: get, put: get, delete: get }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return get
}

describe('labor cost API', () => {
  afterEach(() => mock.restore())

  it('getLaborCost: reads the accrual with the server defaults when no range is given', async () => {
    const get = stubApi(report)
    expect(await getLaborCost('org-1', 'p-1')).toEqual(report)
    expect(get.mock.calls[0][0]).toBe(`${site}/labor-cost`)
  })

  it('getLaborCost: sends only the range ends that are set', async () => {
    const get = stubApi(report)
    await getLaborCost('org-1', 'p-1', { from: '2026-03-01', to: '' })
    expect(get.mock.calls[0][0]).toBe(`${site}/labor-cost?from=2026-03-01`)
    await getLaborCost('org-1', 'p-1', { from: '2026-03-01', to: '2026-03-31' })
    expect(get.mock.calls[1][0]).toBe(`${site}/labor-cost?from=2026-03-01&to=2026-03-31`)
  })

  it('listLaborCostDays: pages one person’s days and keeps the unrated reason', async () => {
    const page = {
      content: [
        {
          day: '2026-03-10',
          membershipId: 'm-2',
          fullName: 'luis@example.test',
          rate: null,
          amount: '0.00',
          unrated: true,
          unratedReason: 'NO_RATE',
        },
        {
          day: '2026-03-10',
          membershipId: 'm-1',
          fullName: 'Ana Perez',
          rate: { kind: 'CATALOG', laborCategory: { id: 'r-1', code: 'MO011', name: 'PEON' }, dailyAmount: null },
          amount: '0.00',
          unrated: true,
          unratedReason: 'NO_COST_YET',
        },
      ],
      page: 1,
      size: 20,
      totalElements: 22,
      totalPages: 2,
    }
    const get = stubApi(page)
    const read = await listLaborCostDays('org-1', 'p-1', { membershipId: 'm-1', from: '2026-03-01', page: 1, size: 20 })
    expect(read.content[0].unratedReason).toBe('NO_RATE')
    expect(read.content[1].rate?.dailyAmount).toBeNull()
    expect(read.totalPages).toBe(2)
    expect(get.mock.calls[0][0]).toBe(`${site}/labor-cost/days?membershipId=m-1&from=2026-03-01&page=1&size=20`)
  })
})

describe('laborRangeIssue', () => {
  it('accepts an open or a valid range', () => {
    expect(laborRangeIssue('', '')).toBeNull()
    expect(laborRangeIssue('2026-03-10', '')).toBeNull()
    expect(laborRangeIssue('2026-03-10', '2026-03-10')).toBeNull()
    // 366 days, both ends included
    expect(laborRangeIssue('2025-03-10', '2026-03-10')).toBeNull()
  })

  it('refuses a start after the end', () => {
    expect(laborRangeIssue('2026-03-11', '2026-03-10')).toBe('order')
  })

  it('refuses a range longer than 366 days', () => {
    expect(laborRangeIssue('2025-03-09', '2026-03-10')).toBe('tooLong')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  getLaborRate,
  laborRateBody,
  laborRateDraft,
  laborRateErrorKind,
  setLaborRate,
  type LaborRate,
  type LaborRateView,
} from '../../../features/sites/laborRate'
import { listSiteAccess } from '../../../features/sites/sitesApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

const catalogRate: LaborRate = {
  kind: 'CATALOG',
  laborCategory: { id: 'r-1', code: 'MO011', name: 'PEON', realWage: '610.00' },
  dailyAmount: '610.00',
  effectiveFrom: '2026-11-15T18:02:11Z',
  setBy: { membershipId: 'm-9', fullName: 'Ana Perez' },
}
const fixedRate: LaborRate = {
  kind: 'FIXED',
  laborCategory: null,
  dailyAmount: '650.00',
  effectiveFrom: '2026-11-16T10:00:00Z',
  setBy: { membershipId: 'm-9', fullName: null },
}
const noneRate: LaborRate = { ...fixedRate, kind: 'NONE', dailyAmount: null }

function view(partial: Partial<LaborRateView>): LaborRateView {
  return { current: null, suggested: null, history: [], ...partial }
}

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}


describe('labor rate draft', () => {
  it('starts from the current rate', () => {
    expect(laborRateDraft(view({ current: catalogRate, suggested: { ...fixedRate, fromProject: { id: 'p-2', name: 'Bridge' } } })))
      .toEqual({ kind: 'CATALOG', category: catalogRate.laborCategory, amount: '', suggestedFrom: null })
    expect(laborRateDraft(view({ current: fixedRate }))).toEqual({ kind: 'FIXED', category: null, amount: '650.00', suggestedFrom: null })
  })

  it('is pre-filled with the rate on another site when there is none here yet', () => {
    expect(laborRateDraft(view({ suggested: { ...fixedRate, fromProject: { id: 'p-2', name: 'Bridge' } } }))).toEqual({
      kind: 'FIXED',
      category: null,
      amount: '650.00',
      suggestedFrom: 'Bridge',
    })
  })

  it('a NONE current rate is kept rather than replaced by the suggestion', () => {
    expect(laborRateDraft(view({ current: noneRate, suggested: { ...catalogRate, fromProject: { id: 'p-2', name: 'Bridge' } } })))
      .toEqual({ kind: 'NONE', category: null, amount: '', suggestedFrom: null })
  })

  it('without any rate starts as a catalog pick', () => {
    expect(laborRateDraft(view({}))).toEqual({ kind: 'CATALOG', category: null, amount: '', suggestedFrom: null })
  })
})

describe('labor rate body', () => {
  it('builds the PUT body of each kind', () => {
    expect(laborRateBody({ kind: 'CATALOG', category: catalogRate.laborCategory, amount: '', suggestedFrom: null }))
      .toEqual({ ok: true, body: { kind: 'CATALOG', laborCategoryId: 'r-1' } })
    expect(laborRateBody({ kind: 'FIXED', category: null, amount: ' 650.5 ', suggestedFrom: null }))
      .toEqual({ ok: true, body: { kind: 'FIXED', dailyAmount: '650.50' } })
    expect(laborRateBody({ kind: 'NONE', category: catalogRate.laborCategory, amount: '3', suggestedFrom: null }))
      .toEqual({ ok: true, body: { kind: 'NONE' } })
  })

  it('refuses a missing category and a bad amount', () => {
    expect(laborRateBody({ kind: 'CATALOG', category: null, amount: '', suggestedFrom: null })).toEqual({ ok: false, error: 'category' })
    for (const amount of ['', '-1', '1.005', 'abc']) {
      expect(laborRateBody({ kind: 'FIXED', category: null, amount, suggestedFrom: null })).toEqual({ ok: false, error: 'amount' })
    }
    expect(laborRateBody({ kind: 'FIXED', category: null, amount: '0', suggestedFrom: null }))
      .toEqual({ ok: true, body: { kind: 'FIXED', dailyAmount: '0.00' } })
  })
})

describe('labor rate API', () => {
  afterEach(() => mock.restore())

  it('reads the rate of an access with its suggestion and history', async () => {
    const data = view({ current: fixedRate, suggested: { ...catalogRate, fromProject: { id: 'p-2', name: 'Bridge' } }, history: [fixedRate] })
    const { get } = stubApi({ get: () => ({ status: 200, data }) })
    expect(await getLaborRate('o-1', 'p-1', 'a-1')).toEqual(data)
    expect(get.mock.calls[0][0]).toBe('/api/organizations/o-1/projects/p-1/access/a-1/labor-rate')
  })

  it('puts the rate and returns the access with it', async () => {
    const access = {
      accessId: 'a-1',
      membershipId: 'm-1',
      userId: 'u-1',
      fullName: 'Ana',
      avatarUrl: null,
      role: { code: 'WORKER', name: 'Trabajador' },
      laborRate: catalogRate,
    }
    const { send } = stubApi({ send: () => ({ status: 200, data: access }) })
    expect((await setLaborRate('o-1', 'p-1', 'a-1', { kind: 'NONE' })).laborRate).toEqual(catalogRate)
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/o-1/projects/p-1/access/a-1/labor-rate')
    expect(body).toEqual({ kind: 'NONE' })
  })

  it('the site people list carries the rate, or null when hidden or absent', async () => {
    const base = { accessId: 'a-1', membershipId: 'm-1', userId: 'u-1', fullName: null, avatarUrl: null, role: { code: 'WORKER', name: 'W' } }
    stubApi({ get: () => ({ status: 200, data: [{ ...base, laborRate: noneRate }, { ...base, accessId: 'a-2' }] }) })
    const list = await listSiteAccess('o-1', 'p-1')
    expect(list[0].laborRate).toEqual(noneRate)
    expect(list[1].laborRate).toBeNull()
  })

  it('maps write failures', () => {
    expect(laborRateErrorKind(new ApiError(403))).toBe('forbidden')
    expect(laborRateErrorKind(new ApiError(404))).toBe('notFound')
    expect(laborRateErrorKind(new ApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalid')
    expect(laborRateErrorKind(new Error('x'))).toBe('generic')
  })
})

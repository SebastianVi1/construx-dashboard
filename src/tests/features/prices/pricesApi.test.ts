import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  getCatalog,
  getResource,
  listFamilies,
  listResourceCosts,
  listResources,
  listSuppliers,
  listUnits,
  pricesErrorKind,
  resourceSearch,
  type CatalogSummary,
  type Family,
  type Resource,
  type ResourceDetail,
  type Supplier,
  type Unit,
} from '../../../features/prices/pricesApi'

const base = '/api/organizations/org-1'

const resource: Resource = {
  id: 'r-1',
  code: '301-ARE-0101',
  type: 'MATERIAL',
  name: 'Arena de mina',
  unit: { id: 'u-1', code: 'M3' },
  family: { id: 'f-1', code: '301', name: 'AGREGADOS' },
  supplier: { id: 's-1', name: 'VARIOS' },
  brand: null,
  isPercentage: false,
  isComposite: false,
  isHourlyCost: false,
  discontinued: false,
  currentCost: '290.00',
  costUpdatedAt: '2026-11-15T18:02:11Z',
  source: 'NEODATA_CONSTRUBASE',
  missingFromImportAt: null,
  archivedAt: null,
}

const detail: ResourceDetail = {
  ...resource,
  description: 'Arena de mina cribada',
  reference: null,
  sapCode: null,
  technicalSheet: null,
  procedure: null,
  grouper: null,
  importedCost: '290.00',
  importedCostOn: '2026-11-01',
  createdAt: '2026-11-15T18:02:11Z',
  updatedAt: '2026-11-15T18:02:11Z',
  history: [
    {
      id: 'h-1',
      amount: '290.00',
      effectiveFrom: '2026-11-15T18:02:11Z',
      source: 'MANUAL',
      recordedBy: { membershipId: 'm-1', fullName: 'Ana López' },
      importId: null,
      supplier: { id: 's-1', name: 'VARIOS' },
      sku: 'A-1',
      note: null,
    },
  ],
  usedIn: { count: 0, sample: [] },
}

const page = { content: [resource], page: 0, size: 50, totalElements: 1, totalPages: 1 }

function stubApi(get: (url: string) => unknown) {
  const getMock = mock(async (url: string) => get(url))
  const client = { get: getMock, post: mock(), patch: mock(), put: mock(), delete: mock() }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return getMock
}

describe('resourceSearch', () => {
  it('sends only the page and size by default', () => {
    expect(resourceSearch({ page: 0, size: 50 })).toBe('page=0&size=50')
  })

  it('repeats type, trims the query and adds each filter and the sort', () => {
    expect(
      resourceSearch({
        types: ['MATERIAL', 'EQUIPMENT'],
        query: '  arena  ',
        familyId: 'f-1',
        unitId: 'u-1',
        supplierId: 's-1',
        includeArchived: true,
        discontinued: false,
        sort: { field: 'currentCost', direction: 'desc' },
        page: 2,
        size: 25,
      }),
    ).toBe(
      'type=MATERIAL&type=EQUIPMENT&query=arena&familyId=f-1&unitId=u-1&supplierId=s-1&includeArchived=true&discontinued=false&sort=currentCost%2Cdesc&page=2&size=25',
    )
  })

  it('leaves out a blank query, archived off and discontinued unset', () => {
    expect(resourceSearch({ query: '   ', includeArchived: false, discontinued: null, page: 0, size: 50 })).toBe('page=0&size=50')
  })
})

describe('prices API', () => {
  afterEach(() => mock.restore())

  it('listResources: gets one page of the catalog with money as strings', async () => {
    const get = stubApi(() => ({ status: 200, data: page }))

    expect(await listResources('org-1', { types: ['MATERIAL'], page: 0, size: 50 })).toEqual(page)
    expect(get.mock.calls[0][0]).toBe(`${base}/resources?type=MATERIAL&page=0&size=50`)
  })

  it('listResources: rejects a cost sent as a number', async () => {
    stubApi(() => ({ status: 200, data: { ...page, content: [{ ...resource, currentCost: 290 }] } }))

    await expect(listResources('org-1', { page: 0, size: 50 })).rejects.toBeInstanceOf(ApiError)
  })

  it('getResource: gets the detail with its cost history', async () => {
    const get = stubApi(() => ({ status: 200, data: detail }))

    expect(await getResource('org-1', 'r 1')).toEqual(detail)
    expect(get.mock.calls[0][0]).toBe(`${base}/resources/r%201`)
  })

  it('getResource: accepts a composite without history', async () => {
    stubApi(() => ({ status: 200, data: { ...detail, isComposite: true, history: null } }))

    expect((await getResource('org-1', 'r-1')).history).toBeNull()
  })

  it('listResourceCosts: pages the whole history', async () => {
    const costs = { content: detail.history ?? [], page: 1, size: 50, totalElements: 51, totalPages: 2 }
    const get = stubApi(() => ({ status: 200, data: costs }))

    expect(await listResourceCosts('org-1', 'r-1', 1)).toEqual(costs)
    expect(get.mock.calls[0][0]).toBe(`${base}/resources/r-1/costs?page=1&size=50`)
  })

  it('getCatalog: reads the summary, also for a company without catalog', async () => {
    const empty: CatalogSummary = {
      exists: false,
      currency: 'MXN',
      counts: { MATERIAL: 0, LABOR: 0, EQUIPMENT: 0, WORK_ITEM: 0, suppliers: 0, units: 0, families: 0 },
      missingFromImport: 0,
      lastImport: null,
      fasar: null,
      activeImport: null,
    }
    const get = stubApi(() => ({ status: 200, data: empty }))

    expect(await getCatalog('org-1')).toEqual(empty)
    expect(get.mock.calls[0][0]).toBe(`${base}/catalog`)
  })

  it('listUnits, listFamilies and listSuppliers read the pickers', async () => {
    const unit: Unit = { id: 'u-1', code: 'M3', description: 'Metro cúbico', source: 'SEED', archivedAt: null, resourceCount: 2 }
    const family: Family = { id: 'f-1', code: '301', name: 'AGREGADOS', source: 'SEED', archivedAt: null, resourceCount: 1 }
    const supplier: Supplier = {
      id: 's-1', name: 'VARIOS', branch: null, website: null, code: 'VAR', rfc: null, address: null, neighborhood: null,
      city: null, state: null, postalCode: null, phone: null, mobile: null, fax: null, email: null, contact: null,
      notes: null, isDefault: false, source: 'NEODATA_CONSTRUBASE', archivedAt: null, resourceCount: 4,
    }
    const get = stubApi((url) => ({
      status: 200,
      data: url.endsWith('/units') ? [unit] : url.endsWith('/families') ? [family] : [supplier],
    }))

    expect(await listUnits('org-1')).toEqual([unit])
    expect(await listFamilies('org-1')).toEqual([family])
    expect(await listSuppliers('org-1')).toEqual([supplier])
    expect(get.mock.calls.map((call) => call[0])).toEqual([`${base}/units`, `${base}/families`, `${base}/suppliers`])
  })
})

describe('pricesErrorKind', () => {
  it('maps the statuses a read can answer', () => {
    expect(pricesErrorKind(new ApiError(403))).toBe('forbidden')
    expect(pricesErrorKind(new ApiError(404))).toBe('notFound')
    expect(pricesErrorKind(new ApiError(401))).toBe('session')
    expect(pricesErrorKind(new ApiError(500))).toBe('generic')
    expect(pricesErrorKind(new Error('offline'))).toBe('generic')
  })
})

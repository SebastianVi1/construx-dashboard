import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  catalogSummarySchema,
  getCatalog,
  getResource,
  listFamilies,
  listResourceCosts,
  listResources,
  listSuppliers,
  listUnits,
  pageSchema,
  resourceDetailSchema,
  resourceSchema,
} from '../../../features/prices/pricesApi'
import { defaultSort, noFilters } from '../../../features/prices/resourceQuery'

const base = '/api/organizations/org-1'

// Examples copied from construx/docs/pricing.md.
const resource = {
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

const historyEntry = {
  id: 'h-1',
  amount: '290.00',
  effectiveFrom: '2026-11-15T18:02:11Z',
  source: 'MANUAL',
  recordedBy: { membershipId: 'm-1', fullName: 'Ana Perez' },
  importId: null,
  supplier: { id: 's-1', name: 'VARIOS' },
  sku: 'HD-1',
  note: 'Cotización de enero',
}

const detail = {
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
  history: [historyEntry, { ...historyEntry, id: 'h-2', recordedBy: null, supplier: null, sku: null, note: null, source: 'NEODATA_CONSTRUBASE', importId: 'i-1' }],
  usedIn: { count: 0, sample: [] },
}

const catalog = {
  exists: true,
  currency: 'MXN',
  counts: { MATERIAL: 24375, LABOR: 85, EQUIPMENT: 145, WORK_ITEM: 10264, suppliers: 9, units: 51, families: 17 },
  missingFromImport: 12,
  lastImport: { id: 'i-1', status: 'DONE', finishedAt: '2026-11-15T18:02:11Z', fileName: 'obra_Presupuesto.xlsx' },
  fasar: { status: 'COMPLETE', year: 2019, uma: '86.8800', minimumWage: '123.22', updatedAt: '2026-11-15T18:02:11Z' },
  activeImport: null,
}

const page = (content: unknown[]) => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1 })

function stubGet(answer: (url: string) => unknown) {
  const get = mock(async (url: string) => ({ status: 200, data: answer(url) }))
  const client = { get, post: get, patch: get, put: get, delete: get }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return get
}

describe('prices schemas', () => {
  it('reads a page with its paging numbers', () => {
    const parsed = pageSchema(z.string()).parse({ content: ['a'], page: 2, size: 50, totalElements: 101, totalPages: 3 })
    expect(parsed).toEqual({ content: ['a'], page: 2, size: 50, totalElements: 101, totalPages: 3 })
  })

  it('rejects a page without totalElements', () => {
    expect(pageSchema(z.string()).safeParse({ content: [], page: 0, size: 50, totalPages: 0 }).success).toBe(false)
  })

  it('reads the contract ResourceResponse example', () => {
    expect(resourceSchema.parse(resource)).toEqual(resource as never)
  })

  it('accepts a resource without family, supplier or cost yet', () => {
    const bare = { ...resource, family: null, supplier: null, currentCost: null, costUpdatedAt: null }
    expect(resourceSchema.safeParse(bare).success).toBe(true)
  })

  it('rejects a cost sent as a number or without two decimals', () => {
    expect(resourceSchema.safeParse({ ...resource, currentCost: 290 }).success).toBe(false)
    expect(resourceSchema.safeParse({ ...resource, currentCost: '290.5' }).success).toBe(false)
  })

  it('reads a detail with its cost history, newest first as sent', () => {
    const parsed = resourceDetailSchema.parse(detail)
    expect(parsed.history?.map((entry) => entry.id)).toEqual(['h-1', 'h-2'])
    expect(parsed.history?.[1].recordedBy).toBeNull()
    expect(parsed.usedIn).toEqual({ count: 0, sample: [] })
  })

  it('reads the catalog summary example and the empty one', () => {
    expect(catalogSummarySchema.parse(catalog).counts.MATERIAL).toBe(24375)
    const empty = {
      exists: false,
      currency: null,
      counts: { MATERIAL: 0, LABOR: 0, EQUIPMENT: 0, WORK_ITEM: 0, suppliers: 0, units: 0, families: 0 },
      missingFromImport: 0,
      lastImport: null,
      fasar: { status: 'NONE' },
      activeImport: null,
    }
    expect(catalogSummarySchema.parse(empty).exists).toBe(false)
  })
})

describe('prices API', () => {
  afterEach(() => mock.restore())

  it('getCatalog reads the summary', async () => {
    const get = stubGet(() => catalog)
    expect((await getCatalog('org-1')).missingFromImport).toBe(12)
    expect(get.mock.calls[0][0]).toBe(`${base}/catalog`)
  })

  it('listResources sends the type, filters, page and sort', async () => {
    const get = stubGet(() => page([resource]))
    const result = await listResources('org-1', {
      types: ['EQUIPMENT'],
      filters: { ...noFilters, query: 'revolvedora' },
      sort: defaultSort,
      page: 1,
    })
    expect(result.content[0].code).toBe('301-ARE-0101')
    expect(get.mock.calls[0][0]).toBe(`${base}/resources?type=EQUIPMENT&query=revolvedora&page=1&size=50&sort=code%2Casc`)
  })

  it('getResource encodes the id', async () => {
    const get = stubGet(() => detail)
    expect((await getResource('org-1', 'r 1')).code).toBe('301-ARE-0101')
    expect(get.mock.calls[0][0]).toBe(`${base}/resources/r%201`)
  })

  it('listResourceCosts reads a page of history entries', async () => {
    const get = stubGet(() => page([historyEntry]))
    expect((await listResourceCosts('org-1', 'r-1', 2)).content[0].amount).toBe('290.00')
    expect(get.mock.calls[0][0]).toBe(`${base}/resources/r-1/costs?page=2&size=200`)
  })

  it('lists units, families and suppliers for the filters', async () => {
    const get = stubGet((url) => {
      if (url.endsWith('/units')) return [{ id: 'u-1', code: 'M3', description: 'Metro cúbico', source: 'SEED', archivedAt: null, resourceCount: 3 }]
      if (url.endsWith('/families')) return [{ id: 'f-1', code: '301', name: 'AGREGADOS', source: 'NEODATA_CONSTRUBASE', archivedAt: null, resourceCount: 9 }]
      return [{ id: 's-1', name: 'VARIOS', branch: null, website: null, archivedAt: null }]
    })
    expect((await listUnits('org-1'))[0].code).toBe('M3')
    expect((await listFamilies('org-1'))[0].name).toBe('AGREGADOS')
    expect((await listSuppliers('org-1'))[0].name).toBe('VARIOS')
    expect(get.mock.calls.map((call) => call[0])).toEqual([`${base}/units`, `${base}/families`, `${base}/suppliers`])
  })

  it('fails with ApiError when the answer does not match the contract', async () => {
    stubGet(() => ({ ...catalog, counts: null }))
    await expect(getCatalog('org-1')).rejects.toBeInstanceOf(ApiError)
  })
})


describe('T1a response contract regressions', () => {
  afterEach(() => mock.restore())

  it('preserves every detail history and usedIn field from the contract example', () => {
    const parsedDetail: unknown = resourceDetailSchema.parse(detail)
    const parsedPage: unknown = pageSchema(resourceSchema).parse(page([resource]))
    expect(parsedDetail).toEqual(detail)
    expect(parsedPage).toEqual(page([resource]))
  })

  it('rejects a detail missing usedIn', () => {
    const incomplete = { ...detail }
    Reflect.deleteProperty(incomplete, 'usedIn')
    expect(resourceDetailSchema.safeParse(incomplete).success).toBe(false)
  })

  it('rejects one-decimal money in imported cost and history entries', () => {
    expect(resourceDetailSchema.safeParse({ ...detail, importedCost: '290.5' }).success).toBe(false)
    expect(resourceDetailSchema.safeParse({ ...detail, history: [{ ...historyEntry, amount: '290.5' }] }).success).toBe(false)
  })

  it('getCatalog accepts the no-catalog response with null currency', async () => {
    const empty = {
      exists: false, currency: null,
      counts: { MATERIAL: 0, LABOR: 0, EQUIPMENT: 0, WORK_ITEM: 0, suppliers: 0, units: 0, families: 0 },
      missingFromImport: 0, lastImport: null, activeImport: null,
      fasar: { status: 'NONE', year: null, uma: null, minimumWage: null, updatedAt: null },
    }
    stubGet(() => empty)
    const result: unknown = await getCatalog('org-1')
    expect(result).toEqual(empty)
  })

  it('encodes organization and resource ids in every read path', async () => {
    const get = stubGet((url) => {
      if (url.endsWith('/catalog')) return catalog
      if (url.includes('/costs?')) return page([historyEntry])
      if (url.includes('/resources?')) return page([resource])
      if (url.endsWith('/resources/r%2F1%3F')) return detail
      return []
    })
    await getCatalog('org/1?')
    await listResources('org/1?', { types: ['MATERIAL', 'EQUIPMENT'], filters: noFilters, sort: defaultSort, page: 0 })
    await getResource('org/1?', 'r/1?')
    await listResourceCosts('org/1?', 'r/1?', 1)
    await listUnits('org/1?')
    await listFamilies('org/1?')
    await listSuppliers('org/1?')
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      '/api/organizations/org%2F1%3F/catalog',
      '/api/organizations/org%2F1%3F/resources?type=MATERIAL&type=EQUIPMENT&page=0&size=50&sort=code%2Casc',
      '/api/organizations/org%2F1%3F/resources/r%2F1%3F',
      '/api/organizations/org%2F1%3F/resources/r%2F1%3F/costs?page=1&size=200',
      '/api/organizations/org%2F1%3F/units', '/api/organizations/org%2F1%3F/families', '/api/organizations/org%2F1%3F/suppliers',
    ])
  })
})

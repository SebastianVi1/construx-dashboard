import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureHttp } from '../../../lib/http'
import { laborCategoryFromLookup, lookupCatalog } from '../../../features/sites/catalogLookup'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const site = '/api/organizations/org-1/projects/p-1'
const peon = { id: 'r-1', code: 'MO011', name: 'Peon', type: 'LABOR', unitCode: 'JOR' }
const page = { content: [peon], page: 0, size: 20, totalElements: 1, totalPages: 1 }

function stubGet(data: unknown) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : { status: 200, data }))
  const client = { get, post: get, patch: get, put: get, delete: get }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return get
}

describe('site catalog lookup', () => {
  afterEach(() => mock.restore())

  it('asks the site for one purpose, by text, first page of twenty', async () => {
    const get = stubGet(page)
    expect(await lookupCatalog('org-1', 'p-1', 'LABOR_RATE', '  peón 1 ')).toEqual(page as never)
    expect(get.mock.calls[0][0]).toBe(`${site}/catalog-lookup?purpose=LABOR_RATE&query=pe%C3%B3n+1&page=0&size=20`)
  })

  it('leaves an empty search out', async () => {
    const get = stubGet(page)
    await lookupCatalog('org-1', 'p-1', 'EXPENSE', '   ')
    expect(get.mock.calls[0][0]).toBe(`${site}/catalog-lookup?purpose=EXPENSE&page=0&size=20`)
  })

  it('keeps only code, name, type and unit even if a cost slipped into the answer', async () => {
    stubGet({ ...page, content: [{ ...peon, currentCost: '610.00' }] })
    const read = await lookupCatalog('org-1', 'p-1', 'LABOR_RATE', '')
    expect(read.content[0]).toEqual(peon as never)
  })

  it('turns a looked-up Labor category into the rate editor pick, without a wage', () => {
    expect(laborCategoryFromLookup({ ...peon, type: 'LABOR' })).toEqual({
      id: 'r-1',
      code: 'MO011',
      name: 'Peon',
      realWage: null,
    })
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import {
  archiveMaterial,
  createMaterial,
  createSupplier,
  deleteObservation,
  getMaterial,
  listMaterials,
  listSuppliers,
  pricingErrorKind,
  recordPrice,
  type Material,
  type MaterialDetail,
  type PriceObservation,
  type Supplier,
} from './pricingApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const base = '/api/organizations/org-1'

const latest = {
  id: 'o-1',
  materialId: 'm-1',
  supplierId: 's-1',
  supplierName: 'Home Depot',
  supplierBranch: 'Periférico Sur',
  price: '245.50',
  observedOn: '2026-10-01',
  sku: null,
  source: 'MANUAL',
  createdAt: '2026-10-01T18:00:00Z',
  cheapest: true,
} as const
const material: Material = {
  id: 'm-1',
  name: 'Cemento gris',
  unit: 'BAG',
  category: 'CEMENT_AGGREGATES',
  brand: 'Cemex',
  archivedAt: null,
  latestPrices: [latest],
  cheapestSupplierId: 's-1',
}
const observation: PriceObservation = {
  id: 'o-1',
  materialId: 'm-1',
  supplierId: 's-1',
  supplierName: 'Home Depot',
  supplierBranch: null,
  price: '245.50',
  observedOn: '2026-10-01',
  sku: 'HD-1',
  source: 'MANUAL',
  createdAt: '2026-10-01T18:00:00Z',
}
const detail: MaterialDetail = { ...material, history: [observation] }
const supplier: Supplier = { id: 's-1', name: 'Home Depot', branch: null, website: null, archivedAt: null }

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

function sent(send: ReturnType<typeof stubApi>['send'], index = 0) {
  return send.mock.calls[index] as unknown as [string, unknown, Config]
}

describe('pricing API', () => {
  afterEach(() => mock.restore())

  it('listMaterials: gets the catalog with its latest prices, money as a string', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [material] }) })

    expect(await listMaterials('org-1')).toEqual([material])
    expect(get.mock.calls[0][0]).toBe(`${base}/materials`)
  })

  it('listMaterials: sends query and category as query params', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [] }) })
    await listMaterials('org-1', { query: 'cemento gris', category: 'STEEL' })

    expect(get.mock.calls[0][0]).toBe(`${base}/materials?query=cemento+gris&category=STEEL`)
  })

  it('listMaterials: rejects a price sent as a number instead of a string', async () => {
    stubApi({ get: () => ({ status: 200, data: [{ ...material, latestPrices: [{ ...latest, price: 245.5 }] }] }) })

    await expect(listMaterials('org-1')).rejects.toBeInstanceOf(AuthApiError)
  })

  it('getMaterial: gets one material with its full history', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: detail }) })

    expect(await getMaterial('org-1', 'm 1')).toEqual(detail)
    expect(get.mock.calls[0][0]).toBe(`${base}/materials/m%201`)
  })

  it('createMaterial: posts trimmed fields with CSRF, leaves out an empty brand and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: material }) })
    await createMaterial('org-1', { name: ' Cemento gris ', unit: 'BAG', category: 'CEMENT_AGGREGATES', brand: ' ' })

    const [url, body, config] = sent(send)
    expect(url).toBe(`${base}/materials`)
    expect(body).toEqual({ name: 'Cemento gris', unit: 'BAG', category: 'CEMENT_AGGREGATES' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('archiveMaterial: posts to the archive route with CSRF', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...material, archivedAt: '2026-10-27T10:00:00Z' } }) })

    expect((await archiveMaterial('org-1', 'm-1')).archivedAt).toBe('2026-10-27T10:00:00Z')
    const [url, , config] = sent(send)
    expect(url).toBe(`${base}/materials/m-1/archive`)
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('listSuppliers: gets the active suppliers', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [supplier] }) })

    expect(await listSuppliers('org-1')).toEqual([supplier])
    expect(get.mock.calls[0][0]).toBe(`${base}/suppliers`)
  })

  it('createSupplier: posts name with optional branch and website, with CSRF', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: supplier }) })
    await createSupplier('org-1', { name: ' Home Depot ', branch: 'Periférico Sur', website: '' })

    const [url, body, config] = sent(send)
    expect(url).toBe(`${base}/suppliers`)
    expect(body).toEqual({ name: 'Home Depot', branch: 'Periférico Sur' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('recordPrice: posts the price as a decimal string with CSRF and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: observation }) })
    const result = await recordPrice('org-1', {
      materialId: 'm-1',
      supplierId: 's-1',
      price: '245.5',
      observedOn: '2026-10-01',
      sku: ' ',
    })

    const [url, body, config] = sent(send)
    expect(url).toBe(`${base}/price-observations`)
    expect(body).toEqual({ materialId: 'm-1', supplierId: 's-1', price: '245.5', observedOn: '2026-10-01' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
    expect(result).toEqual(observation)
  })

  it('deleteObservation: deletes one observation with CSRF and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })
    await deleteObservation('org-1', 'o-1')

    const [url] = sent(send)
    expect(url).toBe(`${base}/price-observations/o-1`)
  })
})

describe('pricing error kinds', () => {
  it('maps each pricing 409 code to its own message kind', () => {
    expect(pricingErrorKind(new AuthApiError(409, undefined, 'DUPLICATE_MATERIAL'))).toBe('duplicateMaterial')
    expect(pricingErrorKind(new AuthApiError(409, undefined, 'DUPLICATE_SUPPLIER'))).toBe('duplicateSupplier')
    expect(pricingErrorKind(new AuthApiError(409, undefined, 'ARCHIVED_MATERIAL'))).toBe('archivedMaterial')
    expect(pricingErrorKind(new AuthApiError(409, undefined, 'ARCHIVED_SUPPLIER'))).toBe('archivedSupplier')
    expect(pricingErrorKind(new AuthApiError(409, undefined, 'DATA_CONFLICT'))).toBe('generic')
  })

  it('maps the other statuses like the rest of the app', () => {
    expect(pricingErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalid')
    expect(pricingErrorKind(new AuthApiError(401))).toBe('session')
    expect(pricingErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(pricingErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(pricingErrorKind(new AuthApiError(500))).toBe('generic')
    expect(pricingErrorKind('boom')).toBe('generic')
  })
})

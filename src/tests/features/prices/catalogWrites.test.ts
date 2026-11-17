import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  archiveFamily,
  archiveSupplier,
  archiveUnit,
  catalogWriteErrorKind,
  createFamily,
  createSupplier,
  createUnit,
  listFamilies,
  listSuppliers,
  listUnits,
  updateFamily,
  updateSupplier,
  updateUnit,
  type Family,
  type Supplier,
  type Unit,
} from '../../../features/prices/pricesApi'

const base = '/api/organizations/org-1'
const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

const supplier: Supplier = {
  id: 's-1',
  name: 'Cementos del Valle',
  branch: null,
  website: null,
  code: 'PROV-01',
  rfc: 'CVA010101AB1',
  address: 'Av. Juárez 10',
  neighborhood: 'Centro',
  city: 'Puebla',
  state: 'Puebla',
  postalCode: '72000',
  phone: '222 111 2233',
  mobile: null,
  fax: null,
  email: 'ventas@cdv.mx',
  contact: 'Ana López',
  notes: null,
  isDefault: false,
  source: 'MANUAL',
  archivedAt: null,
  resourceCount: 3,
}
const unit: Unit = { id: 'u-1', code: 'M3', description: 'Metro cúbico', source: 'MANUAL', archivedAt: null, resourceCount: 0 }
const family: Family = { id: 'f-1', code: '301', name: 'Agregados', source: 'MANUAL', archivedAt: null, resourceCount: 0 }

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

function sent(send: ReturnType<typeof stubApi>['send'], index = 0) {
  return send.mock.calls[index] as unknown as [string, unknown, AxiosRequestConfig]
}

describe('catalog writes', () => {
  afterEach(() => mock.restore())

  it('listSuppliers: sends the search and archived filter and reads the new fields', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [supplier] }) })

    expect(await listSuppliers('org-1', { query: ' valle ', includeArchived: true })).toEqual([supplier])
    expect(await listSuppliers('org-1', { query: '  ' })).toEqual([supplier])
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      `${base}/suppliers?query=valle&includeArchived=true`,
      `${base}/suppliers`,
    ])
  })

  it('createSupplier and updateSupplier send the body with CSRF', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: supplier }) })
    await createSupplier('org-1', { name: 'Cementos del Valle', code: 'PROV-01', isDefault: false })
    const [url, body, config] = sent(send)
    expect(url).toBe(`${base}/suppliers`)
    expect(body).toEqual({ name: 'Cementos del Valle', code: 'PROV-01', isDefault: false })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')

    const patched = stubApi({ send: () => ({ status: 200, data: supplier }) })
    await updateSupplier('org-1', 's-1', { phone: '' })
    expect(sent(patched.send)[0]).toBe(`${base}/suppliers/s-1`)
    expect(sent(patched.send)[1]).toEqual({ phone: '' })
  })

  it('archiveSupplier posts to the archive route', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...supplier, archivedAt: '2026-11-16T10:00:00Z' } }) })
    expect((await archiveSupplier('org-1', 's-1')).archivedAt).toBe('2026-11-16T10:00:00Z')
    expect(sent(send)[0]).toBe(`${base}/suppliers/s-1/archive`)
  })

  it('units: list with archived, create, update and archive', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [unit] }) })
    await listUnits('org-1', { includeArchived: true })
    expect(get.mock.calls[0][0]).toBe(`${base}/units?includeArchived=true`)

    const created = stubApi({ send: () => ({ status: 201, data: unit }) })
    expect(await createUnit('org-1', { code: 'M3', description: 'Metro cúbico' })).toEqual(unit)
    expect(sent(created.send)[0]).toBe(`${base}/units`)

    const updated = stubApi({ send: () => ({ status: 200, data: unit }) })
    await updateUnit('org-1', 'u-1', { description: '' })
    expect(sent(updated.send)[0]).toBe(`${base}/units/u-1`)
    expect(sent(updated.send)[1]).toEqual({ description: '' })

    const archived = stubApi({ send: () => ({ status: 200, data: unit }) })
    await archiveUnit('org-1', 'u-1')
    expect(sent(archived.send)[0]).toBe(`${base}/units/u-1/archive`)
  })

  it('families: list with archived, create, update and archive', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [family] }) })
    await listFamilies('org-1', { includeArchived: true })
    expect(get.mock.calls[0][0]).toBe(`${base}/families?includeArchived=true`)

    const created = stubApi({ send: () => ({ status: 201, data: family }) })
    expect(await createFamily('org-1', { code: '301', name: 'Agregados' })).toEqual(family)
    expect(sent(created.send)[0]).toBe(`${base}/families`)

    const updated = stubApi({ send: () => ({ status: 200, data: family }) })
    await updateFamily('org-1', 'f-1', { name: 'Arenas' })
    expect(sent(updated.send)[1]).toEqual({ name: 'Arenas' })

    const archived = stubApi({ send: () => ({ status: 200, data: family }) })
    await archiveFamily('org-1', 'f-1')
    expect(sent(archived.send)[0]).toBe(`${base}/families/f-1/archive`)
  })
})

describe('catalogWriteErrorKind', () => {
  it('maps the conflict codes and statuses a write can answer', () => {
    expect(catalogWriteErrorKind(new ApiError(409, undefined, 'DUPLICATE_SUPPLIER'))).toBe('duplicateSupplier')
    expect(catalogWriteErrorKind(new ApiError(409, undefined, 'DUPLICATE_UNIT'))).toBe('duplicateUnit')
    expect(catalogWriteErrorKind(new ApiError(409, undefined, 'DUPLICATE_FAMILY'))).toBe('duplicateFamily')
    expect(catalogWriteErrorKind(new ApiError(409, undefined, 'IMPORTED_FIELD'))).toBe('importedField')
    expect(catalogWriteErrorKind(new ApiError(409, undefined, 'DATA_CONFLICT'))).toBe('generic')
    expect(catalogWriteErrorKind(new ApiError(400))).toBe('invalid')
    expect(catalogWriteErrorKind(new ApiError(403))).toBe('forbidden')
    expect(catalogWriteErrorKind(new ApiError(404))).toBe('notFound')
    expect(catalogWriteErrorKind(new ApiError(401))).toBe('session')
    expect(catalogWriteErrorKind(new Error('offline'))).toBe('generic')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../../../features/auth/authApi'
import {
  accessErrorKind,
  assignToSite,
  createSite,
  getSite,
  listSiteAccess,
  listSites,
  removeFromSite,
  setSiteBudget,
  siteErrorKind,
  updateSite,
  type Site,
} from '../../../features/sites/sitesApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const site: Site = {
  id: 'p-1',
  name: 'Torre Norte',
  address: 'Av. Siempre Viva 742',
  startDate: '2026-11-01',
  expectedEndDate: '2027-05-30',
  status: 'ACTIVE',
  activityCount: 12,
  doneCount: 4,
  allocatedBudget: 250000.5,
}
const access = {
  accessId: 'a-1',
  membershipId: 'm-1',
  userId: 'u-1',
  fullName: null,
  role: { code: 'WORKER', name: 'Trabajador' },
}

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

function failure(status: number, code?: string) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: code ? { code } : undefined },
  })
}

describe('sites API', () => {
  afterEach(() => mock.restore())

  it('listSites: gets the open sites without a status filter', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [site] }) })

    expect(await listSites('org-1')).toEqual([site])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects')
  })

  it('listSites: passes the status filter', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [] }) })
    await listSites('org-1', 'ARCHIVED')

    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects?status=ARCHIVED')
  })

  it('listSites: accepts null progress counts and missing optional fields', async () => {
    const bare = { ...site, address: null, startDate: null, expectedEndDate: null, activityCount: null, doneCount: null, allocatedBudget: null }
    stubApi({ get: () => ({ status: 200, data: [bare] }) })

    expect(await listSites('org-1')).toEqual([bare])
  })

  it('getSite: gets one site by encoded ids', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: site }) })
    await getSite('org-1', 'p/1')

    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects/p%2F1')
  })

  it('createSite: posts the trimmed name and only the optional fields that were filled', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: site }) })
    const created = await createSite('org-1', {
      name: '  Torre Norte ',
      address: '  ',
      startDate: '2026-11-01',
      expectedEndDate: '',
      status: '',
    })

    expect(created).toEqual(site)
    const [url, body, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/organizations/org-1/projects')
    expect(body).toEqual({ name: 'Torre Norte', startDate: '2026-11-01' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('updateSite: patches only the given fields and parses the 200 body', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...site, status: 'ARCHIVED' } }) })
    const updated = await updateSite('org-1', 'p-1', { status: 'ARCHIVED' })

    expect(updated.status).toBe('ARCHIVED')
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1')
    expect(body).toEqual({ status: 'ARCHIVED' })
  })

  it('setSiteBudget: puts the amount on the budget endpoint and parses the 200 body', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...site, allocatedBudget: 1000 } }) })
    const updated = await setSiteBudget('org-1', 'p-1', 1000)

    expect(updated.allocatedBudget).toBe(1000)
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/budget')
    expect(body).toEqual({ allocatedBudget: 1000 })
  })

  it('setSiteBudget: sends null to clear the budget', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...site, allocatedBudget: null } }) })

    expect((await setSiteBudget('org-1', 'p-1', null)).allocatedBudget).toBeNull()
    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ allocatedBudget: null })
  })

  it('setSiteBudget: a 403 maps to the forbidden message', async () => {
    stubApi({
      send: () => {
        throw failure(403)
      },
    })

    expect(siteErrorKind(await setSiteBudget('org-1', 'p-1', 1).catch((error: unknown) => error))).toBe('forbidden')
  })

  it('listSiteAccess: gets the people on a site, allowing a null full name', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [access] }) })

    expect(await listSiteAccess('org-1', 'p-1')).toEqual([access])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/projects/p-1/access')
  })

  it('assignToSite: posts the membership id and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: access }) })
    await assignToSite('org-1', 'p-1', 'm-1')

    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/access')
    expect(body).toEqual({ membershipId: 'm-1' })
  })

  it('removeFromSite: deletes with CSRF proof and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })
    await removeFromSite('org-1', 'p-1', 'a-1')

    const [url, config] = send.mock.calls[0] as unknown as [string, Config]
    expect(url).toBe('/api/organizations/org-1/projects/p-1/access/a-1')
    expect(config.withCredentials).toBe(true)
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('removeFromSite: refetches CSRF and retries once after a 403, then reports it', async () => {
    const { get, send } = stubApi({
      send: () => {
        throw failure(403, 'FORBIDDEN')
      },
    })

    await expect(removeFromSite('org-1', 'p-1', 'a-1')).rejects.toMatchObject({ status: 403 })
    expect(send).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('removeFromSite: surfaces the 409 for a person who still has tasks', async () => {
    stubApi({
      send: () => {
        throw failure(409, 'STATE_CONFLICT')
      },
    })

    await expect(removeFromSite('org-1', 'p-1', 'a-1')).rejects.toMatchObject({ status: 409, code: 'STATE_CONFLICT' })
  })
})

describe('site error kinds', () => {
  it('maps a save failure to a message kind', () => {
    expect(siteErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('dateOrder')
    expect(siteErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalid')
    expect(siteErrorKind(new AuthApiError(401))).toBe('session')
    expect(siteErrorKind(new AuthApiError(403, undefined, 'FORBIDDEN'))).toBe('forbidden')
    expect(siteErrorKind(new AuthApiError(404, undefined, 'NOT_FOUND'))).toBe('notFound')
    expect(siteErrorKind(new AuthApiError(500))).toBe('generic')
    expect(siteErrorKind(new Error('boom'))).toBe('generic')
  })

  it('maps a site access failure to a message kind', () => {
    expect(accessErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('hasTasks')
    expect(accessErrorKind(new AuthApiError(409, undefined, 'DATA_CONFLICT'))).toBe('alreadyAssigned')
    expect(accessErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('inactive')
    expect(accessErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(accessErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(accessErrorKind(new AuthApiError(401))).toBe('session')
    expect(accessErrorKind(new AuthApiError(502))).toBe('generic')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureAuthApi } from '../../../features/auth/authApi'
import { canPerform, type MyAccess } from '../../../features/permissions/can'
import { getMyAccess } from '../../../features/permissions/permissionsApi'

const worker: MyAccess = {
  membershipId: 'm-1',
  role: { code: 'WORKER', name: 'Trabajador' },
  permissions: [
    { action: 'VIEW_PROJECT', scope: 'PROJECT' },
    { action: 'VIEW_ACTIVITY', scope: 'PROJECT' },
    { action: 'MANAGE_ACTIVITY', scope: 'OWN' },
  ],
}

const administrator: MyAccess = {
  membershipId: 'm-2',
  role: { code: 'ADMINISTRATOR', name: 'Administrador' },
  permissions: [
    { action: 'MANAGE_MEMBERS', scope: 'ORGANIZATION' },
    { action: 'VIEW_PROJECT', scope: 'ORGANIZATION' },
    { action: 'MANAGE_PROJECT', scope: 'ORGANIZATION' },
  ],
}

describe('canPerform', () => {
  it('denies everything while permissions are unknown', () => {
    expect(canPerform(null, 'VIEW_PROJECT')).toBe(false)
    expect(canPerform(null, 'VIEW_PROJECT', 'p-1')).toBe(false)
  })

  it('denies an action the role does not hold', () => {
    expect(canPerform(worker, 'MANAGE_PROJECT', 'p-1')).toBe(false)
    expect(canPerform(worker, 'MANAGE_MEMBERS')).toBe(false)
  })

  it('ORGANIZATION scope allows the action with or without a site', () => {
    expect(canPerform(administrator, 'MANAGE_PROJECT')).toBe(true)
    expect(canPerform(administrator, 'MANAGE_PROJECT', 'p-1')).toBe(true)
    expect(canPerform(administrator, 'MANAGE_MEMBERS')).toBe(true)
  })

  it('PROJECT scope allows the action only on a site', () => {
    expect(canPerform(worker, 'VIEW_PROJECT')).toBe(false)
    expect(canPerform(worker, 'VIEW_PROJECT', 'p-1')).toBe(true)
  })

  it('PROJECT scope is denied on a site the caller is known not to be on', () => {
    expect(canPerform(worker, 'VIEW_PROJECT', 'p-1', { onSite: false })).toBe(false)
    expect(canPerform(worker, 'VIEW_PROJECT', 'p-1', { onSite: true })).toBe(true)
  })

  it('OWN scope allows the action only for the caller own task on a site', () => {
    expect(canPerform(worker, 'MANAGE_ACTIVITY')).toBe(false)
    expect(canPerform(worker, 'MANAGE_ACTIVITY', 'p-1')).toBe(false)
    expect(canPerform(worker, 'MANAGE_ACTIVITY', 'p-1', { own: true })).toBe(true)
  })
})

describe('permissions API', () => {
  afterEach(() => mock.restore())

  it('getMyAccess: gets the caller role and permissions for an organization', async () => {
    const get = mock(async () => ({ status: 200, data: worker }))
    configureAuthApi({ client: { get } as unknown as AxiosInstance, baseUrl: '/api' })

    expect(await getMyAccess('org/1')).toEqual(worker)
    const [url, config] = get.mock.calls[0] as unknown as [string, { withCredentials?: boolean }]
    expect(url).toBe('/api/organizations/org%2F1/me')
    expect(config.withCredentials).toBe(true)
  })

  it('getMyAccess: rejects an unknown scope', async () => {
    const bad = { ...worker, permissions: [{ action: 'VIEW_PROJECT', scope: 'GALAXY' }] }
    const get = mock(async () => ({ status: 200, data: bad }))
    configureAuthApi({ client: { get } as unknown as AxiosInstance, baseUrl: '/api' })

    await expect(getMyAccess('org-1')).rejects.toMatchObject({ status: 200 })
  })
})

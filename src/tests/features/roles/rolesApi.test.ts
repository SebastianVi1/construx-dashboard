import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  createRole,
  deleteRole,
  forgetCatalog,
  getCatalog,
  getRole,
  listRoles,
  restoreRole,
  roleErrorKind,
  updateRole,
  type Grant,
  type PermissionCatalog,
} from '../../../features/roles/rolesApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

const owner = {
  id: 'r-0',
  code: 'OWNER',
  kind: 'OWNER',
  name: 'Propietario',
  names: { en: 'Owner', es: 'Propietario' },
  description: { en: 'Runs the company.', es: 'Dirige la empresa.' },
  system: true,
  customized: false,
  memberCount: 1,
  pendingInvitationCount: 0,
  editable: false,
  assignable: false,
  version: 0,
}
const worker = {
  ...owner,
  id: 'r-2',
  code: 'WORKER',
  kind: 'BUILT_IN',
  name: 'Trabajador',
  names: { en: 'Worker', es: 'Trabajador' },
  description: { en: 'Field staff.', es: 'Personal de campo.' },
  customized: true,
  memberCount: 12,
  pendingInvitationCount: 1,
  editable: true,
  assignable: true,
  version: 3,
}
const foreman = {
  ...worker,
  id: 'r-9',
  code: 'CUSTOM_ABCDEFGHIJ',
  kind: 'CUSTOM',
  name: 'Capataz',
  names: { en: 'Capataz', es: 'Capataz' },
  description: null,
  system: false,
  customized: false,
  memberCount: 0,
  pendingInvitationCount: 0,
}

function stubApi(responses: { get?: (url: string) => unknown; send?: (url: string) => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async (url: string) => responses.send?.(url))
  configureHttp({ client: { get, post: send, put: send, delete: send } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('roles API', () => {
  afterEach(() => mock.restore())

  it('parsesRoleListWithKindsAndFlags', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [owner, worker, foreman] }) })

    const roles = await listRoles('org-1')

    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/roles')
    expect(roles.map((role) => [role.code, role.kind, role.editable, role.assignable])).toEqual([
      ['OWNER', 'OWNER', false, false],
      ['WORKER', 'BUILT_IN', true, true],
      ['CUSTOM_ABCDEFGHIJ', 'CUSTOM', true, true],
    ])
    expect(roles[1]).toMatchObject({ customized: true, memberCount: 12, pendingInvitationCount: 1, version: 3 })
    expect(roles[2].description).toBeNull()
  })

  it('rejects a role list with an unknown kind', async () => {
    stubApi({ get: () => ({ status: 200, data: [{ ...worker, kind: 'SEEDED' }] }) })

    await expect(listRoles('org-1')).rejects.toBeDefined()
  })

  it('getRole: reads one role with its permissions and, for a Built-in role, the defaults', async () => {
    const permissions: Grant[] = [
      { action: 'VIEW_PROJECT', scope: 'PROJECT' },
      { action: 'VIEW_ACTIVITY', scope: 'OWN' },
    ]
    const defaults: Grant[] = [{ action: 'VIEW_PROJECT', scope: 'PROJECT' }]
    const detail = { ...worker, permissions, defaults }
    const { get } = stubApi({ get: () => ({ status: 200, data: detail }) })

    const role = await getRole('org-1', 'WORKER')

    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/roles/WORKER')
    expect(role.permissions).toEqual(detail.permissions)
    expect(role.defaults).toEqual(detail.defaults)
  })

  it('getRole: a Custom role has no defaults', async () => {
    stubApi({ get: () => ({ status: 200, data: { ...foreman, permissions: [], defaults: null } }) })

    expect((await getRole('org-1', 'CUSTOM_ABCDEFGHIJ')).defaults).toBeNull()
  })

  it('getRole: surfaces the 404 for an unknown code', async () => {
    stubApi({ get: () => ({ status: 404, data: { code: 'NOT_FOUND' } }) })

    await expect(getRole('org-1', 'NOPE')).rejects.toMatchObject({ status: 404 })
  })
})

const catalog: PermissionCatalog = {
  groups: [
    { key: 'SITES', names: { en: 'Sites', es: 'Obras' } },
    { key: 'PLANS', names: { en: 'Plans', es: 'Planos' } },
  ],
  actions: [
    {
      action: 'VIEW_PROJECT',
      group: 'SITES',
      names: { en: 'View sites', es: 'Ver obras' },
      descriptions: { en: 'Open sites.', es: 'Abrir obras.' },
      scopes: ['PROJECT', 'ORGANIZATION'],
      requires: [],
    },
    {
      action: 'MANAGE_PLAN',
      group: 'PLANS',
      names: { en: 'Edit plans', es: 'Editar planos' },
      descriptions: { en: 'Upload plans.', es: 'Subir planos.' },
      scopes: ['PROJECT', 'ORGANIZATION'],
      requires: [
        { action: 'VIEW_PLAN', minScope: 'SAME' },
        { action: 'VIEW_PROJECT', minScope: 'PROJECT' },
      ],
    },
  ],
}

describe('role writes', () => {
  afterEach(() => mock.restore())

  type Call = [string, unknown, { headers?: Record<string, string> }]
  const detail = { ...foreman, permissions: [{ action: 'VIEW_PROJECT', scope: 'PROJECT' }], defaults: null }
  const grants = [{ action: 'VIEW_PROJECT', scope: 'PROJECT' as const }]

  it('createRole: posts name, description and permissions with CSRF proof and expects 201', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: detail }) })

    const role = await createRole('org-1', { name: ' Capataz ', description: '', permissions: grants })

    const [url, body, config] = send.mock.calls[0] as unknown as Call
    expect(url).toBe('/api/organizations/org-1/roles')
    expect(body).toEqual({ name: 'Capataz', description: null, permissions: grants })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
    expect(role.code).toBe('CUSTOM_ABCDEFGHIJ')
  })

  it('updateRole: sends the version, and no name or description for a Built-in role', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...worker, permissions: grants, defaults: grants } }) })

    await updateRole('org-1', 'WORKER', { permissions: grants }, 3)
    await updateRole('org-1', 'CUSTOM_ABCDEFGHIJ', { name: 'Capataz', description: 'Lead', permissions: [] }, 4)

    expect(send.mock.calls[0][0]).toBe('/api/organizations/org-1/roles/WORKER')
    expect((send.mock.calls[0] as unknown as Call)[1]).toEqual({ permissions: grants, version: 3 })
    expect((send.mock.calls[1] as unknown as Call)[1]).toEqual({
      name: 'Capataz',
      description: 'Lead',
      permissions: [],
      version: 4,
    })
  })

  it('restoreRole: posts the version to restore-defaults', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: { ...worker, permissions: grants, defaults: grants } }) })

    await restoreRole('org-1', 'WORKER', 3)

    expect(send.mock.calls[0][0]).toBe('/api/organizations/org-1/roles/WORKER/restore-defaults')
    expect((send.mock.calls[0] as unknown as Call)[1]).toEqual({ version: 3 })
  })

  it('deleteRole: names the replacement only when given and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })

    await deleteRole('org-1', 'CUSTOM_ABCDEFGHIJ')
    await deleteRole('org-1', 'CUSTOM_ABCDEFGHIJ', 'WORKER')

    expect(send.mock.calls.map((call) => call[0])).toEqual([
      '/api/organizations/org-1/roles/CUSTOM_ABCDEFGHIJ',
      '/api/organizations/org-1/roles/CUSTOM_ABCDEFGHIJ?replacement=WORKER',
    ])
  })
})

describe('permission catalog', () => {
  afterEach(() => {
    mock.restore()
    forgetCatalog()
  })

  it('catalogIsFetchedOnce', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: catalog }) })

    const [first, second] = await Promise.all([getCatalog(), getCatalog()])
    const third = await getCatalog()

    expect(get.mock.calls.map((call) => call[0])).toEqual(['/api/permissions/catalog'])
    expect(first).toEqual(catalog)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('asks again after a failed fetch', async () => {
    let calls = 0
    const { get } = stubApi({ get: () => (++calls === 1 ? { status: 500, data: {} } : { status: 200, data: catalog }) })

    await expect(getCatalog()).rejects.toMatchObject({ status: 500 })
    expect(await getCatalog()).toEqual(catalog)
    expect(get).toHaveBeenCalledTimes(2)
  })
})

describe('roleErrorKind', () => {
  it('mapsEveryRoleErrorCode', () => {
    const cases: [number, string, string][] = [
      [403, 'ROLE_ABOVE_CALLER', 'roleAboveCaller'],
      [403, 'ROLE_OWN', 'roleOwn'],
      [400, 'ROLE_OWNER_LOCKED', 'roleOwnerLocked'],
      [400, 'ROLE_SCOPE_INVALID', 'roleScopeInvalid'],
      [400, 'ROLE_DEPENDENCY_MISSING', 'roleDependencyMissing'],
      [400, 'ROLE_NAME_INVALID', 'roleNameInvalid'],
      [400, 'ROLE_NAME_FIXED', 'roleNameFixed'],
      [409, 'ROLE_NAME_TAKEN', 'roleNameTaken'],
      [409, 'ROLE_LIMIT_REACHED', 'roleLimitReached'],
      [409, 'ROLE_CHANGED', 'roleChanged'],
      [400, 'ROLE_NOT_BUILT_IN', 'roleNotBuiltIn'],
      [400, 'ROLE_BUILT_IN_UNDELETABLE', 'roleBuiltInUndeletable'],
      [409, 'ROLE_REPLACEMENT_REQUIRED', 'roleReplacementRequired'],
      [400, 'ROLE_REPLACEMENT_INVALID', 'roleReplacementInvalid'],
    ]
    for (const [status, code, kind] of cases) expect([code, roleErrorKind(new ApiError(status, undefined, code))]).toEqual([code, kind])
  })

  it('falls back to the status when the code is not a role rule', () => {
    expect(roleErrorKind(new ApiError(401))).toBe('session')
    expect(roleErrorKind(new ApiError(403, undefined, 'FORBIDDEN'))).toBe('forbidden')
    expect(roleErrorKind(new ApiError(404, undefined, 'NOT_FOUND'))).toBe('notFound')
    expect(roleErrorKind(new ApiError(500))).toBe('generic')
    expect(roleErrorKind(new Error('offline'))).toBe('generic')
  })
})

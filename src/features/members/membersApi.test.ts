import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { messages } from '../../i18n/messages'
import {
  createInvitation,
  invitableRoles,
  inviteErrorKind,
  listInvitations,
  listMembers,
  listRoles,
  makeInviteSchema,
  revokeErrorKind,
  revokeInvitation,
} from './membersApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const invitation = {
  id: 'i-1',
  email: 'bob@example.com',
  role: { code: 'WORKER', name: 'Trabajador' },
  projectId: null,
  status: 'PENDING',
  expiresAt: '2026-11-02T10:00:00Z',
}
const member = {
  membershipId: 'm-1',
  userId: 'u-1',
  email: 'ana@acme.com',
  fullName: null,
  role: { code: 'MEMBER', name: 'Miembro' },
  status: 'ACTIVE',
}
const roles = [
  { id: 'r-0', code: 'OWNER', name: 'Propietario', system: true },
  { id: 'r-1', code: 'ADMINISTRATOR', name: 'Administrador', system: false },
  { id: 'r-2', code: 'WORKER', name: 'Trabajador', system: false },
]

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  configureAuthApi({ client: { get, post: send, delete: send } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('members API', () => {
  afterEach(() => mock.restore())

  it('listMembers: gets the active members, allowing a null full name', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [member] }) })

    expect(await listMembers('org-1')).toEqual([member])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/members')
  })

  it('listRoles: gets the organization roles', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: roles }) })

    expect(await listRoles('org-1')).toEqual(roles)
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/roles')
  })

  it('invitableRoles: leaves out OWNER, which cannot be invited', () => {
    expect(invitableRoles(roles).map((role) => role.code)).toEqual(['ADMINISTRATOR', 'WORKER'])
  })

  it('listInvitations: gets the pending invitations', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [invitation] }) })

    expect(await listInvitations('org-1')).toEqual([invitation])
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/invitations?status=PENDING')
  })

  it('createInvitation: posts email and role, and the site only when chosen', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: invitation }) })
    await createInvitation('org-1', { email: ' bob@example.com ', roleCode: 'WORKER', projectId: '' })
    await createInvitation('org-1', { email: 'bob@example.com', roleCode: 'WORKER', projectId: 'p-1' })

    const [url, first, config] = send.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/organizations/org-1/invitations')
    expect(first).toEqual({ email: 'bob@example.com', roleCode: 'WORKER' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
    expect((send.mock.calls[1] as unknown as [string, unknown])[1]).toEqual({
      email: 'bob@example.com',
      roleCode: 'WORKER',
      projectId: 'p-1',
    })
  })

  it('createInvitation: surfaces the 409 for an existing member', async () => {
    stubApi({
      send: () => {
        throw Object.assign(new Error('Conflict'), {
          isAxiosError: true,
          response: { status: 409, data: { code: 'STATE_CONFLICT' } },
        })
      },
    })

    await expect(createInvitation('org-1', { email: 'ana@acme.com', roleCode: 'WORKER', projectId: '' })).rejects.toMatchObject({
      status: 409,
      code: 'STATE_CONFLICT',
    })
  })

  it('revokeInvitation: deletes with CSRF proof and expects 204', async () => {
    const { send } = stubApi({ send: () => ({ status: 204, data: '' }) })
    await revokeInvitation('org-1', 'i-1')

    const [url, config] = send.mock.calls[0] as unknown as [string, Config]
    expect(url).toBe('/api/organizations/org-1/invitations/i-1')
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })
})

describe('invitation rules', () => {
  const schema = makeInviteSchema(messages.en.members.validation)

  it('requires a valid email and a role; the site is optional', () => {
    expect(schema.safeParse({ email: ' bob@example.com ', roleCode: 'WORKER', projectId: '' }).success).toBe(true)
    const invalid = schema.safeParse({ email: 'bob', roleCode: '', projectId: '' })
    expect(invalid.success ? [] : invalid.error.issues.map((issue) => issue.path[0])).toEqual(['email', 'roleCode'])
  })

  it('maps an invite failure to a message kind', () => {
    expect(inviteErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('alreadyMember')
    expect(inviteErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalidEmail')
    expect(inviteErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalid')
    expect(inviteErrorKind(new AuthApiError(401))).toBe('session')
    expect(inviteErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(inviteErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(inviteErrorKind(new Error('offline'))).toBe('generic')
  })

  it('maps a revoke failure to a message kind', () => {
    expect(revokeErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('notPending')
    expect(revokeErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(revokeErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(revokeErrorKind(new AuthApiError(401))).toBe('session')
    expect(revokeErrorKind(new AuthApiError(500))).toBe('generic')
  })
})

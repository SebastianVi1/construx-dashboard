import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { acceptErrorKind, acceptInvitation, joinedPath } from './invitationsApi'

type Config = { headers?: Record<string, string> }

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const accepted = {
  organization: { id: 'org-9', name: 'Acme Builders' },
  membershipId: 'm-9',
  role: { code: 'WORKER', name: 'Trabajador' },
  projectId: 'p-3',
}

function stubApi(send: () => unknown) {
  const get = mock(async () => csrfOk)
  const post = mock(async () => send())
  configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })
  return { post }
}

describe('accept invitation API', () => {
  afterEach(() => mock.restore())

  it('posts the token with CSRF and parses the joined organization', async () => {
    const { post } = stubApi(() => ({ status: 200, data: accepted }))

    expect(await acceptInvitation('raw-token')).toEqual(accepted)
    const [url, body, config] = post.mock.calls[0] as unknown as [string, unknown, Config]
    expect(url).toBe('/api/invitations/accept')
    expect(body).toEqual({ token: 'raw-token' })
    expect(config.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('accepts an invitation without a site', async () => {
    stubApi(() => ({ status: 200, data: { ...accepted, projectId: null } }))

    expect((await acceptInvitation('raw-token')).projectId).toBeNull()
  })
})

describe('after accepting', () => {
  it('opens the joined site, or the workspace when the invitation names none', () => {
    expect(joinedPath({ ...accepted, projectId: 'p 3' })).toBe('/sites/p%203')
    expect(joinedPath({ ...accepted, projectId: null })).toBe('/')
  })
})

describe('accept error kinds', () => {
  it('maps an accept failure to a message kind', () => {
    expect(acceptErrorKind(new AuthApiError(404, undefined, 'NOT_FOUND'))).toBe('notForYou')
    expect(acceptErrorKind(new AuthApiError(409, undefined, 'STATE_CONFLICT'))).toBe('unavailable')
    expect(acceptErrorKind(new AuthApiError(429, 30))).toBe('rateLimited')
    expect(acceptErrorKind(new AuthApiError(401))).toBe('session')
    expect(acceptErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('notForYou')
    expect(acceptErrorKind(new AuthApiError(500))).toBe('generic')
    expect(acceptErrorKind(new Error('offline'))).toBe('generic')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../auth/authApi'
import { createOrganization, getOrganization, listOrganizations } from './organizationsApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }
type SendCall = [url: string, data?: unknown, config?: Config]
type GetCall = [url: string, config?: Config]

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const acme = { id: '7f1c2a9e-0000-4000-8000-000000000001', name: 'Acme Builders', status: 'ACTIVE' }

function stubApi(getImpl: (url: string) => unknown, postImpl: () => unknown = () => ({ status: 201, data: acme })) {
  const get = mock(async (url: string) => getImpl(url))
  const post = mock(async () => postImpl())
  configureAuthApi({ client: { get, post } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, post }
}

function axiosFailure(status: number, data?: unknown) {
  return Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status, data } })
}

describe('organizations API', () => {
  afterEach(() => mock.restore())

  it('createOrganization: posts the trimmed name with CSRF proof and parses the 201 body', async () => {
    const { post } = stubApi(() => csrfOk)
    const organization = await createOrganization('  Acme Builders  ')

    expect(organization).toEqual({ ...acme, myRole: null })
    expect(post).toHaveBeenCalledTimes(1)
    const [url, data, config] = post.mock.calls[0] as unknown as SendCall
    expect(url).toBe('/api/organizations')
    expect(data).toEqual({ name: 'Acme Builders' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('createOrganization: keeps myRole when the backend sends it', async () => {
    const withRole = { ...acme, myRole: { code: 'OWNER', name: 'Owner' } }
    stubApi(() => csrfOk, () => ({ status: 201, data: withRole }))

    expect(await createOrganization('Acme Builders')).toEqual(withRole)
  })

  it('createOrganization: exposes status and problem code of a validation failure', async () => {
    stubApi(() => csrfOk, () => {
      throw axiosFailure(400, { code: 'VALIDATION_FAILED', errors: { name: 'must not be blank' } })
    })

    const failure = createOrganization('x')
    await expect(failure).rejects.toBeInstanceOf(AuthApiError)
    await expect(failure).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' })
  })

  it('createOrganization: rejects an unexpected success status', async () => {
    stubApi(() => csrfOk, () => ({ status: 200, data: acme }))
    await expect(createOrganization('Acme Builders')).rejects.toMatchObject({ status: 200 })
  })

  it('listOrganizations: gets the caller organizations with cookies', async () => {
    const { get } = stubApi(() => ({ status: 200, data: [acme] }))
    const organizations = await listOrganizations()

    expect(organizations).toEqual([{ ...acme, myRole: null }])
    expect(get).toHaveBeenCalledTimes(1)
    const [url, config] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/organizations')
    expect(config?.withCredentials).toBe(true)
  })

  it('listOrganizations: rejects a malformed body', async () => {
    stubApi(() => ({ status: 200, data: [{ id: 1 }] }))
    await expect(listOrganizations()).rejects.toBeInstanceOf(AuthApiError)
  })

  it('getOrganization: gets one organization by an encoded id', async () => {
    const { get } = stubApi(() => ({ status: 200, data: acme }))
    await getOrganization('a/b')

    const [url] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/organizations/a%2Fb')
  })

  it('getOrganization: maps a non-member to status 404', async () => {
    stubApi(() => {
      throw axiosFailure(404, { code: 'NOT_FOUND' })
    })
    await expect(getOrganization(acme.id)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})

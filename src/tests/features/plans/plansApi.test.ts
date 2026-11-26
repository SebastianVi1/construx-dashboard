import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import { fakeStorage } from '../../support/fakeStorage'
import {
  completePlanUpload,
  deletePlan,
  getSitePlans,
  planErrorKind,
  requestPlanUpload,
  sendToStorage,
  StorageUploadError,
  type Plan,
} from '../../../features/plans/plansApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const base = '/api/organizations/o-1/projects/p-1/plans'
const plan: Plan = {
  id: 'pl-1',
  projectId: 'p-1',
  name: 'Ground floor',
  description: null,
  fileName: 'Ground floor.webp',
  contentType: 'image/webp',
  sizeBytes: 2048,
  createdAt: '2026-10-28T18:00:00Z',
  completedAt: '2026-10-28T18:00:05Z',
  viewUrl: 'https://bucket.test/view',
  viewUrlExpiresAt: '2026-10-28T18:10:05Z',
}

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('plans API', () => {
  afterEach(() => mock.restore())

  it('requestPlanUpload: sends the file metadata and leaves out a blank name and description', async () => {
    const ticket = { planId: 'pl-1', uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: '2030-01-01T00:00:00Z' }
    const { send } = stubApi({ send: () => ({ status: 201, data: ticket }) })
    const result = await requestPlanUpload('o-1', 'p-1', {
      fileName: 'plan.webp',
      contentType: 'image/webp',
      sizeBytes: 10,
      name: '  ',
      description: ' Level 0 ',
      folderId: null,
    })
    expect(result).toEqual(ticket)
    expect((send.mock.calls[0] as unknown as [string, unknown])[0]).toBe(`${base}/uploads`)
    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ fileName: 'plan.webp', contentType: 'image/webp', sizeBytes: 10, description: 'Level 0' })
  })

  it('completePlanUpload and deletePlan: call the plan endpoints', async () => {
    const { send } = stubApi({ send: () => ({ status: 200, data: plan }) })
    expect(await completePlanUpload('o-1', 'p-1', 'pl-1')).toEqual(plan)
    expect((send.mock.calls[0] as unknown as [string, unknown])[0]).toBe(`${base}/pl-1/complete`)

    const deleted = stubApi({ send: () => ({ status: 204 }) })
    await deletePlan('o-1', 'p-1', 'pl-1')
    expect((deleted.send.mock.calls[0] as unknown as [string, unknown])[0]).toBe(`${base}/pl-1`)
  })

  it('sendToStorage: PUTs the file with only the signed headers, no cookies, and reports progress', async () => {
    const transfers = fakeStorage(200)
    const progress: number[] = []
    const body = new Blob(['x'], { type: 'image/webp' })

    await sendToStorage({ uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' } }, body, (p) => progress.push(p))
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      method: 'put',
      url: 'https://bucket.test/put',
      headers: { 'Content-Type': 'image/webp' },
      withCredentials: false,
      data: body,
    })
    expect(transfers[0].headers).not.toHaveProperty('X-XSRF-TOKEN')
    expect(progress).toEqual([0.5, 1])
  })

  it('sendToStorage: rejects with StorageUploadError on a storage error status', async () => {
    fakeStorage(403)
    const ticket = { uploadUrl: 'https://bucket.test/put', headers: {} }

    const error = await sendToStorage(ticket, new Blob(['x']), () => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUploadError)
    expect(error).toMatchObject({ status: 403 })
  })

  it('sendToStorage: refuses an unsafe upload URL before sending anything', async () => {
    const transfers = fakeStorage(200)

    const error = await sendToStorage({ uploadUrl: 'http://bucket.test/put', headers: {} }, new Blob(['x']), () => {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUploadError)
    expect(transfers).toHaveLength(0)
  })

  it('getSitePlans: GETs plans filtered by folderId, never from a cache', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [plan] }) })
    const result = await getSitePlans('o-1', 'p-1', 'f-1')
    expect(result).toEqual([plan])
    const url = (get.mock.calls[0] as unknown as [string])[0]
    expect(url).toStartWith(`${base}?folderId=f-1&fresh=`)
  })

  it('requestPlanUpload: includes folderId in body when provided', async () => {
    const ticket = { planId: 'pl-1', uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: '2030-01-01T00:00:00Z' }
    const { send } = stubApi({ send: () => ({ status: 201, data: ticket }) })
    await requestPlanUpload('o-1', 'p-1', {
      fileName: 'plan.webp',
      contentType: 'image/webp',
      sizeBytes: 10,
      name: 'Level 1',
      description: '',
      folderId: 'f-42',
    })
    expect((send.mock.calls[0] as unknown as [string, unknown])[1]).toEqual({ fileName: 'plan.webp', contentType: 'image/webp', sizeBytes: 10, name: 'Level 1', folderId: 'f-42' })
  })

  it('requestPlanUpload: omits folderId from body when null', async () => {
    const ticket = { planId: 'pl-1', uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: '2030-01-01T00:00:00Z' }
    const { send } = stubApi({ send: () => ({ status: 201, data: ticket }) })
    await requestPlanUpload('o-1', 'p-1', {
      fileName: 'plan.webp',
      contentType: 'image/webp',
      sizeBytes: 10,
      name: '',
      description: '',
      folderId: null,
    })
    const body = (send.mock.calls[0] as unknown as [string, unknown])[1] as Record<string, unknown>
    expect('folderId' in body).toBe(false)
  })

  it('planErrorKind: maps server and storage failures to messages', () => {
    expect(planErrorKind(new ApiError(400, undefined, 'PLAN_FILE_TYPE'))).toBe('fileType')
    expect(planErrorKind(new ApiError(400, undefined, 'PLAN_FILE_TOO_LARGE'))).toBe('tooLarge')
    expect(planErrorKind(new ApiError(400, undefined, 'PLAN_UPLOAD_MISSING'))).toBe('uploadFailed')
    expect(planErrorKind(new ApiError(400, undefined, 'PLAN_UPLOAD_MISMATCH'))).toBe('uploadFailed')
    expect(planErrorKind(new StorageUploadError(403))).toBe('uploadFailed')
    expect(planErrorKind(new ApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalid')
    expect(planErrorKind(new ApiError(401))).toBe('session')
    expect(planErrorKind(new ApiError(403))).toBe('forbidden')
    expect(planErrorKind(new ApiError(404))).toBe('notFound')
    expect(planErrorKind(new Error('x'))).toBe('generic')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { AuthApiError, configureAuthApi } from '../../../features/auth/authApi'
import {
  completePlanUpload,
  deletePlan,
  listPlans,
  planErrorKind,
  requestPlanUpload,
  sendToStorage,
  StorageUploadError,
  type Plan,
  type StorageRequest,
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
  configureAuthApi({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

/** A fake XMLHttpRequest that answers with `status` after reporting progress. */
function fakeRequest(status: number, fail = false) {
  const calls: { method?: string; url?: string; headers: Record<string, string>; body?: unknown; credentials?: boolean } = {
    headers: {},
  }
  const request = {
    status: 0,
    withCredentials: false,
    upload: { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null },
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    open(method: string, url: string) {
      calls.method = method
      calls.url = url
    },
    setRequestHeader(name: string, value: string) {
      calls.headers[name] = value
    },
    send(body: unknown) {
      calls.body = body
      calls.credentials = request.withCredentials
      request.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
      if (fail) {
        request.onerror?.()
        return
      }
      request.status = status
      request.onload?.()
    },
  }
  return { request: request as unknown as StorageRequest, calls }
}

describe('plans API', () => {
  afterEach(() => mock.restore())

  it('listPlans: gets the ready plans of the site', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [plan] }) })
    expect(await listPlans('o-1', 'p-1')).toEqual([plan])
    expect((get.mock.calls[0] as unknown as [string])[0]).toBe(base)
  })

  it('requestPlanUpload: sends the file metadata and leaves out a blank name and description', async () => {
    const ticket = { planId: 'pl-1', uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: '2030-01-01T00:00:00Z' }
    const { send } = stubApi({ send: () => ({ status: 201, data: ticket }) })
    const result = await requestPlanUpload('o-1', 'p-1', {
      fileName: 'plan.webp',
      contentType: 'image/webp',
      sizeBytes: 10,
      name: '  ',
      description: ' Level 0 ',
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
    const { request, calls } = fakeRequest(200)
    const progress: number[] = []
    const body = new Blob(['x'], { type: 'image/webp' })
    await sendToStorage({ uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/webp' } }, body, (p) => progress.push(p), () => request)
    expect(calls).toEqual({
      method: 'PUT',
      url: 'https://bucket.test/put',
      headers: { 'Content-Type': 'image/webp' },
      body,
      credentials: false,
    })
    expect(progress).toEqual([0.5, 1])
  })

  it('sendToStorage: rejects on a storage error status or a network error', async () => {
    const ticket = { uploadUrl: 'https://bucket.test/put', headers: {} }
    await expect(sendToStorage(ticket, new Blob(['x']), () => {}, () => fakeRequest(403).request)).rejects.toBeInstanceOf(StorageUploadError)
    await expect(sendToStorage(ticket, new Blob(['x']), () => {}, () => fakeRequest(0, true).request)).rejects.toBeInstanceOf(StorageUploadError)
  })

  it('planErrorKind: maps server and storage failures to messages', () => {
    expect(planErrorKind(new AuthApiError(400, undefined, 'PLAN_FILE_TYPE'))).toBe('fileType')
    expect(planErrorKind(new AuthApiError(400, undefined, 'PLAN_FILE_TOO_LARGE'))).toBe('tooLarge')
    expect(planErrorKind(new AuthApiError(400, undefined, 'PLAN_UPLOAD_MISSING'))).toBe('uploadFailed')
    expect(planErrorKind(new AuthApiError(400, undefined, 'PLAN_UPLOAD_MISMATCH'))).toBe('uploadFailed')
    expect(planErrorKind(new StorageUploadError(403))).toBe('uploadFailed')
    expect(planErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalid')
    expect(planErrorKind(new AuthApiError(401))).toBe('session')
    expect(planErrorKind(new AuthApiError(403))).toBe('forbidden')
    expect(planErrorKind(new AuthApiError(404))).toBe('notFound')
    expect(planErrorKind(new Error('x'))).toBe('generic')
  })
})

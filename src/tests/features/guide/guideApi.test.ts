import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureHttp } from '../../../lib/http'
import { getGuide, markGuideStepRemote, setGuideDismissed } from '../../../features/guide/guideApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }
type SendCall = [url: string, data?: unknown, config?: Config]
type GetCall = [url: string, config?: Config]

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const notStarted = { started: false, steps: {}, dismissedAt: null, updatedAt: null }
const started = {
  started: true,
  steps: { 'create-site': 'COMPLETED', 'invite-member': 'SKIPPED' },
  dismissedAt: null,
  updatedAt: '2026-11-20T10:00:00Z',
}

function stubApi(getImpl: () => unknown, putImpl: () => unknown = () => ({ status: 200, data: started })) {
  const get = mock(async () => getImpl())
  const put = mock(async () => putImpl())
  configureHttp({ client: { get, put } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, put }
}

describe('guide API', () => {
  afterEach(() => mock.restore())

  it('getGuide: reads a member who has not started, with credentials', async () => {
    const { get } = stubApi(() => ({ status: 200, data: notStarted }))

    expect(await getGuide('o1')).toEqual(notStarted)
    const [url, config] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/organizations/o1/guide')
    expect(config?.withCredentials).toBe(true)
  })

  it('getGuide: reads saved progress and encodes the company id', async () => {
    const { get } = stubApi(() => ({ status: 200, data: started }))

    expect(await getGuide('org/1')).toEqual(started)
    const [url] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/organizations/org%2F1/guide')
  })

  it('getGuide: rejects an unknown step status', async () => {
    stubApi(() => ({ status: 200, data: { ...started, steps: { x: 'DONE' } } }))
    await expect(getGuide('o1')).rejects.toThrow()
  })

  it('markGuideStepRemote: puts the status with CSRF proof', async () => {
    const { put } = stubApi(() => csrfOk)

    expect(await markGuideStepRemote('o1', 'create-site', 'COMPLETED')).toEqual(started)
    expect(put).toHaveBeenCalledTimes(1)
    const [url, data, config] = put.mock.calls[0] as unknown as SendCall
    expect(url).toBe('/api/organizations/o1/guide/steps/create-site')
    expect(data).toEqual({ status: 'COMPLETED' })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('markGuideStepRemote: rejects a response with an unknown status', async () => {
    stubApi(
      () => csrfOk,
      () => ({ status: 200, data: { ...started, steps: { 'create-site': 'DONE' } } }),
    )
    await expect(markGuideStepRemote('o1', 'create-site', 'SKIPPED')).rejects.toThrow()
  })

  it('setGuideDismissed: puts the dismissed flag with CSRF proof', async () => {
    const dismissed = { ...started, dismissedAt: '2026-11-21T09:00:00Z' }
    const { put } = stubApi(
      () => csrfOk,
      () => ({ status: 200, data: dismissed }),
    )

    expect(await setGuideDismissed('o1', true)).toEqual(dismissed)
    const [url, data, config] = put.mock.calls[0] as unknown as SendCall
    expect(url).toBe('/api/organizations/o1/guide')
    expect(data).toEqual({ dismissed: true })
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('setGuideDismissed: sends false to un-dismiss', async () => {
    const { put } = stubApi(() => csrfOk)

    await setGuideDismissed('o1', false)
    const [, data] = put.mock.calls[0] as unknown as SendCall
    expect(data).toEqual({ dismissed: false })
  })
})

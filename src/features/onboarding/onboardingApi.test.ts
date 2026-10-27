import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureAuthApi } from '../auth/authApi'
import { getOnboarding, putOnboarding } from './onboardingApi'

type Config = { withCredentials?: boolean; headers?: Record<string, string> }
type SendCall = [url: string, data?: unknown, config?: Config]
type GetCall = [url: string, config?: Config]

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const saved = { intent: 'RUN_COMPANY' as const, businessType: null, updatedAt: '2026-10-26T10:00:00Z' }

function stubApi(getImpl: () => unknown, putImpl: () => unknown = () => ({ status: 200, data: saved })) {
  const get = mock(async () => getImpl())
  const put = mock(async () => putImpl())
  configureAuthApi({ client: { get, put } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, put }
}

describe('onboarding API', () => {
  afterEach(() => mock.restore())

  it('getOnboarding: reads the all-null answer of a new user', async () => {
    const { get } = stubApi(() => ({ status: 200, data: { intent: null, businessType: null, updatedAt: null } }))

    expect(await getOnboarding()).toEqual({ intent: null, businessType: null, updatedAt: null })
    const [url, config] = get.mock.calls[0] as unknown as GetCall
    expect(url).toBe('/api/onboarding')
    expect(config?.withCredentials).toBe(true)
  })

  it('getOnboarding: rejects an unknown intent', async () => {
    stubApi(() => ({ status: 200, data: { intent: 'BOSS', businessType: null, updatedAt: null } }))
    await expect(getOnboarding()).rejects.toThrow()
  })

  it('putOnboarding: puts intent and a null businessType with CSRF proof', async () => {
    const { put } = stubApi(() => csrfOk)
    const result = await putOnboarding({ intent: 'RUN_COMPANY', businessType: null })

    expect(result).toEqual(saved)
    expect(put).toHaveBeenCalledTimes(1)
    const [url, data, config] = put.mock.calls[0] as unknown as SendCall
    expect(url).toBe('/api/onboarding')
    expect(data).toEqual({ intent: 'RUN_COMPANY', businessType: null })
    expect(config?.withCredentials).toBe(true)
    expect(config?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('putOnboarding: refetches CSRF proof and retries once after a 403', async () => {
    let calls = 0
    const { get, put } = stubApi(
      () => csrfOk,
      () => {
        calls += 1
        if (calls === 1) throw Object.assign(new Error('Forbidden'), { isAxiosError: true, response: { status: 403 } })
        return { status: 200, data: saved }
      },
    )

    await putOnboarding({ intent: 'WORKER_OR_INVITED', businessType: 'SUBCONTRACTOR' })
    expect(get).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(2)
  })
})

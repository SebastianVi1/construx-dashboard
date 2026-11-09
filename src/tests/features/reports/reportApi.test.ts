import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import { generateReport, getDownloadUrl, listReports, reportSchema, type SiteReport } from '../../../features/reports/reportApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

const report: SiteReport = {
  id: 'r-1',
  title: 'Cierre Q4 2025',
  status: 'READY',
  generatedByName: 'Ana Pérez',
  createdAt: '2025-12-01T10:00:00Z',
  completedAt: '2025-12-01T10:00:45Z',
  sizeBytes: 204800,
}

function stubApi(responses: { get?: (url: string) => unknown; send?: () => unknown } = {}) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : responses.get?.(url)))
  const send = mock(async () => responses.send?.())
  const client = { get, post: send, patch: send, put: send, delete: send }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, send }
}

describe('report schema', () => {
  it('parses a complete report', () => {
    expect(reportSchema.parse(report)).toEqual(report)
  })

  it('accepts null generatedByName and completedAt', () => {
    const pending: SiteReport = { ...report, status: 'PENDING', generatedByName: null, completedAt: null, sizeBytes: null }
    expect(reportSchema.parse(pending)).toEqual(pending)
  })

  it('rejects an unknown status', () => {
    expect(reportSchema.safeParse({ ...report, status: 'UNKNOWN' }).success).toBe(false)
  })

  it('rejects a missing id', () => {
    const noId = Object.fromEntries(Object.entries(report).filter(([k]) => k !== 'id'))
    expect(reportSchema.safeParse(noId).success).toBe(false)
  })
})

describe('listReports', () => {
  afterEach(() => mock.restore())

  it('fetches reports for an org and site', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: [report] }) })
    const result = await listReports('org-1', 'site-1')
    expect(result).toEqual([report])
    const [url] = get.mock.calls[0] as unknown as [string]
    expect(url).toBe('/api/organizations/org-1/projects/site-1/reports')
  })

  it('throws on a 403', async () => {
    stubApi({ get: () => { throw new ApiError(403) } })
    await expect(listReports('org-1', 'site-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('generateReport', () => {
  afterEach(() => mock.restore())

  it('posts to the reports endpoint with the title', async () => {
    const { send } = stubApi({ send: () => ({ status: 201, data: report }) })
    const result = await generateReport('org-1', 'site-1', 'Q4 2025')
    expect(result).toEqual(report)
    const [url, body] = send.mock.calls[0] as unknown as [string, unknown]
    expect(url).toBe('/api/organizations/org-1/projects/site-1/reports')
    expect(body).toEqual({ title: 'Q4 2025' })
  })

  it('throws on a 403', async () => {
    stubApi({ send: () => { throw new ApiError(403) } })
    await expect(generateReport('org-1', 'site-1', 'Q4')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('getDownloadUrl', () => {
  afterEach(() => mock.restore())

  it('fetches the download URL for a specific report', async () => {
    const { get } = stubApi({ get: () => ({ status: 200, data: { downloadUrl: 'https://s3.example.com/report.pdf' } }) })
    const url = await getDownloadUrl('org-1', 'site-1', 'r-1')
    expect(url).toBe('https://s3.example.com/report.pdf')
    const [calledUrl] = get.mock.calls[0] as unknown as [string]
    expect(calledUrl).toBe('/api/organizations/org-1/projects/site-1/reports/r-1/download')
  })

  it('throws on a 404', async () => {
    stubApi({ get: () => { throw new ApiError(404) } })
    await expect(getDownloadUrl('org-1', 'site-1', 'r-1')).rejects.toBeInstanceOf(ApiError)
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { uploadDocumentFile } from '../../../features/documents/documentFoldersApi'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'

const ticket = {
  entryId: 'entry-1',
  uploadUrl: 'https://s3.example/put?sig=1',
  headers: { 'x-amz-meta-org': 'org-1' },
  expiresAt: '2026-11-09T12:00:00Z',
  s3Key: 'org-1/site-2/entry-1',
}

const entry = {
  id: 'entry-1',
  folderId: 'folder-3',
  fileName: 'plan.pdf',
  fileSize: 5,
  fileType: 'application/pdf',
  sourceFeature: 'manual',
  createdAt: '2026-11-09T12:00:00Z',
  downloadUrl: 'https://s3.example/get?sig=1',
  downloadUrlExpiresAt: '2026-11-09T13:00:00Z',
}

/** Fake API (upload ticket + confirm) and fake storage answering the PUT with `storageStatus`. */
function fakeBackend(storageStatus: number) {
  const api: string[] = []
  const storage: { url: string; init?: RequestInit }[] = []
  configureHttp({
    baseUrl: '/api',
    fetcher: async (request: HttpRequest) => {
      const path = request.url.replace('/api', '')
      if (path === '/auth/csrf') return { status: 200, data: { headerName: 'X-XSRF-TOKEN', token: 't' } }
      api.push(`${request.method} ${path}`)
      if (path.endsWith('/upload-url')) return { status: 200, data: ticket }
      return { status: 201, data: entry }
    },
    storageFetch: async (url, init) => {
      storage.push({ url, init })
      return new Response(null, { status: storageStatus })
    },
  })
  return { api, storage }
}

const base = '/organizations/org-1/projects/site-2/document-folders/folder-3/entries'

afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

describe('uploadDocumentFile', () => {
  it('stores the file with the signed headers, then confirms the entry', async () => {
    const backend = fakeBackend(200)
    const file = new File(['hello'], 'plan.pdf', { type: 'application/pdf' })

    await expect(uploadDocumentFile('org-1', 'site-2', 'folder-3', file)).resolves.toEqual(entry)
    expect(backend.storage).toHaveLength(1)
    expect(backend.storage[0].url).toBe(ticket.uploadUrl)
    expect(backend.storage[0].init?.headers).toEqual({
      'Content-Type': 'application/pdf',
      'x-amz-meta-org': 'org-1',
    })
    expect(backend.api).toEqual([`post ${base}/upload-url`, `post ${base}`])
  })

  it('does not confirm the entry when storage rejects the upload', async () => {
    const backend = fakeBackend(403)
    const file = new File(['hello'], 'plan.pdf', { type: 'application/pdf' })

    const error = await uploadDocumentFile('org-1', 'site-2', 'folder-3', file).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(backend.api).toEqual([`post ${base}/upload-url`])
  })
})

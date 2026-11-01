import { afterEach, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { configureAuthApi } from '../../../features/auth/authApi'
import { deletePlanFolder, getPlanLibrary, movePlan, savePlanFolder } from '../../../features/plans/planLibraryApi'

const folder = { id: 'folder', name: 'Structure', parentId: null }
const library = { folders: [folder], sites: [], plans: [], canManageFolders: true }
const plan = { id: 'plan', projectId: 'site', folderId: 'folder', name: 'Floor', description: null, fileName: 'a.png', contentType: 'image/png', sizeBytes: 10, createdAt: '', completedAt: '', viewUrl: null, viewUrlExpiresAt: null }
const csrf = { status: 200, data: { headerName: 'X-CSRF-TOKEN', token: 'proof', parameterName: '_csrf' } }
afterEach(() => configureAuthApi({ baseUrl: '/api' }))

it('reads shared server state and sends folder changes through the authenticated CSRF API', async () => {
  const get = mock(async (url: string) => url.endsWith('/auth/csrf') ? csrf : { status: 200, data: library })
  const post = mock(async () => ({ status: 201, data: folder }))
  const patch = mock(async () => ({ status: 200, data: folder }))
  const put = mock(async () => ({ status: 200, data: plan }))
  const remove = mock(async () => ({ status: 204 }))
  configureAuthApi({ baseUrl: '/api', client: { get, post, patch, put, delete: remove } as unknown as AxiosInstance })
  expect(await getPlanLibrary('org')).toEqual(library)
  expect(await savePlanFolder('org', null, 'Structure', null)).toEqual(folder)
  expect(await savePlanFolder('org', 'folder', 'Renamed', null)).toEqual(folder)
  expect(await movePlan('org', 'site', 'plan', 'folder')).toEqual(plan)
  await deletePlanFolder('org', 'folder')
  expect((get.mock.calls[0] as unknown[])[0]).toBe('/api/organizations/org/plan-library')
  const postCall = post.mock.calls[0] as unknown as [string, unknown, { withCredentials: boolean; headers: Record<string, string> }]
  expect(postCall[0]).toBe('/api/organizations/org/plan-folders')
  expect(postCall[1]).toEqual({ name: 'Structure', parentId: null })
  expect(postCall[2].withCredentials).toBe(true)
  expect(postCall[2].headers['X-CSRF-TOKEN']).toBe('proof')
  expect((put.mock.calls[0] as unknown as unknown[]).slice(0, 2)).toEqual(['/api/organizations/org/projects/site/plans/plan/folder', { folderId: 'folder' }])
  expect((remove.mock.calls[0] as unknown as unknown[])[0]).toBe('/api/organizations/org/plan-folders/folder')
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  addProgressNote,
  listProgressNotes,
  noteDraftError,
  progressNoteErrorKind,
  requestProgressNotePhotoUpload,
} from '../../../features/tasks/progressNotesApi'

const at = { organizationId: 'org/1', siteId: 'site', goalId: 'phase' }
const path = '/api/organizations/org%2F1/projects/site/goals/phase/activities/task%2F1/progress-notes'
const note = {
  id: 'n-1',
  text: 'Slab poured',
  source: 'WHATSAPP' as const,
  author: { membershipId: 'm-1', name: 'Ana Perez' },
  createdAt: '2026-11-24T10:00:00Z',
  photos: [],
}
const csrf = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const sent = { withCredentials: true, headers: { 'X-XSRF-TOKEN': 'proof', Accept: 'application/problem+json, application/json' } }
afterEach(() => mock.restore())

describe('listProgressNotes', () => {
  it('reads the task notes in server order, keeping the WhatsApp source and a missing author name', async () => {
    const unnamed = { ...note, id: 'n-2', source: 'APP' as const, author: { membershipId: 'm-2', name: null } }
    const get = mock(async () => ({ status: 200, data: [note, unnamed] }))
    configureHttp({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
    expect(await listProgressNotes(at, 'task/1')).toEqual([note, unnamed])
    expect((get.mock.calls[0] as unknown as [string])[0]).toBe(path)
  })

  it('keeps a photo-only note and its photo links in order', async () => {
    const photos = { ...note, text: null, photos: [{ id: 'p-1', url: 'https://s3/1' }, { id: 'p-2', url: 'https://s3/2' }] }
    const get = mock(async () => ({ status: 200, data: [photos] }))
    configureHttp({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
    expect(await listProgressNotes(at, 'task/1')).toEqual([photos])
  })
})

describe('addProgressNote', () => {
  it('posts the trimmed text and the photo keys with CSRF', async () => {
    const get = mock(async () => csrf)
    const post = mock(async () => ({ status: 201, data: { ...note, source: 'APP' } }))
    configureHttp({ baseUrl: '/api', client: { get, post } as unknown as AxiosInstance })
    expect(await addProgressNote(at, 'task/1', '  Slab poured  ', ['k1', 'k2'])).toEqual({ ...note, source: 'APP' })
    expect((post.mock.calls[0] as unknown as unknown[])).toEqual([path, { text: 'Slab poured', photoKeys: ['k1', 'k2'] }, sent])
  })

  it('sends no text for a note of photos only', async () => {
    const get = mock(async () => csrf)
    const post = mock(async () => ({ status: 201, data: { ...note, text: null, photos: [{ id: 'p', url: 'u' }] } }))
    configureHttp({ baseUrl: '/api', client: { get, post } as unknown as AxiosInstance })
    await addProgressNote(at, 'task/1', '   ', ['k1'])
    expect((post.mock.calls[0] as unknown as unknown[])[1]).toEqual({ photoKeys: ['k1'] })
  })
})

describe('requestProgressNotePhotoUpload', () => {
  it('asks for a presigned upload on the task for this type and size', async () => {
    const ticket = { key: 'orgs/k', uploadUrl: 'https://s3/put', headers: { 'Content-Type': 'image/png' }, expiresAt: 'x' }
    const get = mock(async () => csrf)
    const post = mock(async () => ({ status: 201, data: ticket }))
    configureHttp({ baseUrl: '/api', client: { get, post } as unknown as AxiosInstance })
    expect(await requestProgressNotePhotoUpload(at, 'task/1', 'image/png', 1234)).toEqual(ticket)
    expect((post.mock.calls[0] as unknown as unknown[])).toEqual([`${path}/photo-uploads`, { contentType: 'image/png', sizeBytes: 1234 }, sent])
  })
})

describe('noteDraftError', () => {
  it('needs text or a photo, at most 1000 characters and 5 photos', () => {
    expect(noteDraftError('   ', 0)).toBe('empty')
    expect(noteDraftError('   ', 1)).toBeNull()
    expect(noteDraftError('x'.repeat(1001), 1)).toBe('tooLong')
    expect(noteDraftError(` ${'x'.repeat(1000)} `, 0)).toBeNull()
    expect(noteDraftError('Slab', 5)).toBeNull()
    expect(noteDraftError('Slab', 6)).toBe('tooManyPhotos')
  })
})

describe('progressNoteErrorKind', () => {
  it('tells an empty note, a lost permission and a missing task apart', () => {
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'PROGRESS_NOTE_EMPTY'))).toBe('empty')
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('tooLong')
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'PROGRESS_NOTE_TOO_MANY_PHOTOS'))).toBe('tooManyPhotos')
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'PROGRESS_NOTE_PHOTO_INVALID'))).toBe('photoInvalid')
    expect(progressNoteErrorKind(new ApiError(403))).toBe('forbidden')
    expect(progressNoteErrorKind(new ApiError(404))).toBe('notFound')
    expect(progressNoteErrorKind(new ApiError(401))).toBe('session')
    expect(progressNoteErrorKind(new Error('offline'))).toBe('generic')
  })
})

import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  addProgressNote,
  listProgressNotes,
  noteDraftError,
  progressNoteErrorKind,
} from '../../../features/tasks/progressNotesApi'

const at = { organizationId: 'org/1', siteId: 'site', goalId: 'phase' }
const path = '/api/organizations/org%2F1/projects/site/goals/phase/activities/task%2F1/progress-notes'
const note = {
  id: 'n-1',
  text: 'Slab poured',
  source: 'WHATSAPP' as const,
  author: { membershipId: 'm-1', name: 'Ana Perez' },
  createdAt: '2026-11-24T10:00:00Z',
}
afterEach(() => mock.restore())

describe('listProgressNotes', () => {
  it('reads the task notes in server order, keeping the WhatsApp source and a missing author name', async () => {
    const unnamed = { ...note, id: 'n-2', source: 'APP' as const, author: { membershipId: 'm-2', name: null } }
    const get = mock(async () => ({ status: 200, data: [note, unnamed] }))
    configureHttp({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
    expect(await listProgressNotes(at, 'task/1')).toEqual([note, unnamed])
    expect((get.mock.calls[0] as unknown as [string])[0]).toBe(path)
  })
})

describe('addProgressNote', () => {
  it('posts the trimmed text with CSRF', async () => {
    const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
    const post = mock(async () => ({ status: 201, data: { ...note, source: 'APP' } }))
    configureHttp({ baseUrl: '/api', client: { get, post } as unknown as AxiosInstance })
    expect(await addProgressNote(at, 'task/1', '  Slab poured  ')).toEqual({ ...note, source: 'APP' })
    expect((post.mock.calls[0] as unknown as unknown[])).toEqual([path, { text: 'Slab poured' }, {
      withCredentials: true, headers: { 'X-XSRF-TOKEN': 'proof', Accept: 'application/problem+json, application/json' },
    }])
  })
})

describe('noteDraftError', () => {
  it('needs text and allows at most 1000 characters', () => {
    expect(noteDraftError('   ')).toBe('empty')
    expect(noteDraftError('x'.repeat(1001))).toBe('tooLong')
    expect(noteDraftError(` ${'x'.repeat(1000)} `)).toBeNull()
  })
})

describe('progressNoteErrorKind', () => {
  it('tells an empty note, a lost permission and a missing task apart', () => {
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'PROGRESS_NOTE_EMPTY'))).toBe('empty')
    expect(progressNoteErrorKind(new ApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('tooLong')
    expect(progressNoteErrorKind(new ApiError(403))).toBe('forbidden')
    expect(progressNoteErrorKind(new ApiError(404))).toBe('notFound')
    expect(progressNoteErrorKind(new ApiError(401))).toBe('session')
    expect(progressNoteErrorKind(new Error('offline'))).toBe('generic')
  })
})

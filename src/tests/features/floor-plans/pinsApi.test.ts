import { afterEach, describe, expect, it } from 'bun:test'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'
import {
  addPinPhotos,
  createPin,
  deletePinPhoto,
  getPin,
  listPins,
  pinSchema,
  requestPinPhotoUpload,
  setPinStatus,
  updatePin,
} from '../../../features/floor-plans/pinsApi'

const pin = {
  id: 'p1',
  floorPlanId: 'fp1',
  kind: 'ISSUE',
  x: 10.5,
  y: 20,
  title: 'Cracked tile',
  description: null,
  status: 'OPEN',
  assignee: { membershipId: 'm2', fullName: 'Ana Perez' },
  createdBy: { membershipId: 'm1', fullName: null },
  zoneId: 'z1',
  zoneName: 'Slab A',
  photoCount: 1,
  coverUrl: 'https://s3/cover',
  version: 0,
  createdAt: '2026-11-10T10:00:00Z',
  resolvedAt: null,
  closedAt: null,
  can: { edit: true, assign: false, resolve: true, close: false, reopen: false, delete: true },
  photos: null,
}
const detail = { ...pin, photos: [{ id: 'ph1', phase: 'REPORT', url: 'https://s3/1', createdAt: '2026-11-10T10:00:00Z' }] }
const base = '/api/organizations/o1/projects/s1/floor-plans/fp1/pins'

function serve(status: number, data: unknown, seen: HttpRequest[] = []) {
  configureHttp({
    baseUrl: '/api',
    fetcher: async (req) => {
      seen.push(req)
      // The CSRF token read that precedes every unsafe call
      if (req.url.endsWith('/auth/csrf')) return { status: 200, data: { headerName: 'X-XSRF-TOKEN', token: 't' } }
      return { status, data }
    },
  })
}
const calls = (seen: HttpRequest[]) => seen.filter((r) => !r.url.endsWith('/auth/csrf'))

afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

describe('pinSchema', () => {
  it('parses a progress photo pin, which has no status, title or assignee', () => {
    const photo = pinSchema.parse({ ...pin, kind: 'PHOTO', title: null, status: null, assignee: null })
    expect(photo.status).toBeNull()
  })

  it('rejects an unknown status', () => {
    expect(pinSchema.safeParse({ ...pin, status: 'DONE' }).success).toBe(false)
  })
})

describe('listPins', () => {
  it('reads the pins of a plan', async () => {
    const seen: HttpRequest[] = []
    serve(200, [pin], seen)
    const result = await listPins('o1', 's1', 'fp1')
    expect(seen[0].url).toBe(base)
    expect(result[0].zoneName).toBe('Slab A')
    expect(result[0].can.resolve).toBe(true)
  })

  it('sends only the filters that are set', async () => {
    const seen: HttpRequest[] = []
    serve(200, [], seen)
    await listPins('o1', 's1', 'fp1', { kind: 'ISSUE', status: 'OPEN', assignee: 'me', zoneId: 'z 1' })
    expect(seen[0].url).toBe(`${base}?kind=ISSUE&status=OPEN&assignee=me&zoneId=z+1`)
    await listPins('o1', 's1', 'fp1', { status: 'CLOSED' })
    expect(seen[1].url).toBe(`${base}?status=CLOSED`)
  })

  it('rejects with the API error', async () => {
    serve(403, { code: 'FORBIDDEN' })
    await expect(listPins('o1', 's1', 'fp1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('pin calls', () => {
  it('reads one pin with its photos', async () => {
    const seen: HttpRequest[] = []
    serve(200, detail, seen)
    const result = await getPin('o1', 's1', 'fp1', 'p 1')
    expect(seen[0].url).toBe(`${base}/p%201`)
    expect(result.photos[0].phase).toBe('REPORT')
  })

  it('creates a pin', async () => {
    const seen: HttpRequest[] = []
    serve(201, detail, seen)
    const body = { kind: 'ISSUE' as const, x: 1, y: 2, title: 'T', description: null, assigneeMembershipId: null, photoKeys: ['k1'] }
    await createPin('o1', 's1', 'fp1', body)
    const [call] = calls(seen)
    expect(call.method).toBe('post')
    expect(call.url).toBe(base)
    expect(call.body).toEqual(body)
  })

  it('updates a pin with its version', async () => {
    const seen: HttpRequest[] = []
    serve(200, detail, seen)
    await updatePin('o1', 's1', 'fp1', 'p1', { title: 'T', description: null, x: 1, y: 2, assigneeMembershipId: 'm2', version: 3 })
    const [call] = calls(seen)
    expect(call.method).toBe('patch')
    expect(call.url).toBe(`${base}/p1`)
    expect((call.body as { version: number }).version).toBe(3)
  })

  it('posts a status change with its resolution photos', async () => {
    const seen: HttpRequest[] = []
    serve(200, { ...detail, status: 'RESOLVED' }, seen)
    const result = await setPinStatus('o1', 's1', 'fp1', 'p1', 'RESOLVED', ['k2'])
    const [call] = calls(seen)
    expect(call.url).toBe(`${base}/p1/status`)
    expect(call.body).toEqual({ status: 'RESOLVED', photoKeys: ['k2'] })
    expect(result.status).toBe('RESOLVED')
  })

  it('adds and deletes photos', async () => {
    const seen: HttpRequest[] = []
    serve(200, detail, seen)
    await addPinPhotos('o1', 's1', 'fp1', 'p1', ['k3'], 'RESOLUTION')
    expect(calls(seen)[0].url).toBe(`${base}/p1/photos`)
    expect(calls(seen)[0].body).toEqual({ keys: ['k3'], phase: 'RESOLUTION' })
    serve(204, undefined, seen)
    await deletePinPhoto('o1', 's1', 'fp1', 'p1', 'ph1')
    expect(calls(seen)[1].method).toBe('delete')
    expect(calls(seen)[1].url).toBe(`${base}/p1/photos/ph1`)
  })

  it('asks for a photo upload ticket', async () => {
    const seen: HttpRequest[] = []
    serve(201, { key: 'k', uploadUrl: 'https://s3/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: 'x' }, seen)
    const ticket = await requestPinPhotoUpload('o1', 's1', 'fp1', 'image/webp', 1234)
    expect(calls(seen)[0].url).toBe(`${base}/photo-uploads`)
    expect(calls(seen)[0].body).toEqual({ contentType: 'image/webp', sizeBytes: 1234 })
    expect(ticket.key).toBe('k')
  })
})

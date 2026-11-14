import { afterEach, describe, expect, it } from 'bun:test'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'
import { checkIn, getAttendance, getCheckInZones, removeCheckIn } from '../../../features/attendance/attendanceApi'

const ownCheckIn = {
  id: 'c1',
  membershipId: 'm1',
  zone: null,
  date: '2026-03-10',
  checkedInAt: '2026-03-10T15:00:00Z',
  recordedBy: { membershipId: 'm1', name: 'Ana Perez' },
}
const attendance = {
  date: '2026-03-10',
  today: true,
  people: [{ membershipId: 'm1', name: 'Ana Perez', avatarUrl: null, state: 'PRESENT', checkIn: ownCheckIn }],
  me: { membershipId: 'm1' },
}

function serve(answer: (req: HttpRequest) => { status: number; data: unknown }, seen: HttpRequest[] = []) {
  configureHttp({
    baseUrl: '/api',
    fetcher: async (req) => {
      seen.push(req)
      if (req.url.endsWith('/auth/csrf')) return { status: 200, data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
      return answer(req)
    },
  })
}

afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

describe('attendance API', () => {
  it('getAttendance: asks for the Site without a date and returns the day the backend chose', async () => {
    const seen: HttpRequest[] = []
    serve(() => ({ status: 200, data: attendance }), seen)

    const result = await getAttendance('o 1', 's1')

    expect(seen[0].url).toBe('/api/organizations/o%201/projects/s1/attendance')
    expect(result.date).toBe('2026-03-10')
    expect(result.today).toBe(true)
    expect(result.people[0].checkIn.recordedBy.name).toBe('Ana Perez')
    expect(result.me.membershipId).toBe('m1')
  })

  it('getAttendance: rejects with the API error', async () => {
    serve(() => ({ status: 403, data: { code: 'FORBIDDEN' } }))
    await expect(getAttendance('o1', 's1')).rejects.toBeInstanceOf(ApiError)
  })

  it('checkIn: posts with the CSRF proof and no date of its own', async () => {
    const seen: HttpRequest[] = []
    serve(() => ({ status: 201, data: ownCheckIn }), seen)

    const result = await checkIn('o1', 's1')

    const post = seen.find((req) => req.method === 'post')
    expect(post?.url).toBe('/api/organizations/o1/projects/s1/attendance/check-ins')
    expect(post?.headers?.['X-XSRF-TOKEN']).toBe('proof')
    expect(post?.body).toEqual({ zoneId: null })
    expect(result).toEqual(ownCheckIn)
  })

  it('checkIn: sends the zone picked and returns the Check-in with its zone', async () => {
    const seen: HttpRequest[] = []
    const zone = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    serve(() => ({ status: 201, data: { ...ownCheckIn, zone } }), seen)

    const result = await checkIn('o1', 's1', 'z1')

    expect(seen.find((req) => req.method === 'post')?.body).toEqual({ zoneId: 'z1' })
    expect(result.zone).toEqual(zone)
  })

  it('checkIn: a Check-in without a zone field is present with no zone', async () => {
    const { zone: _zone, ...older } = ownCheckIn
    void _zone
    serve(() => ({ status: 201, data: older }))
    expect((await checkIn('o1', 's1')).zone).toBeNull()
  })

  it('checkIn: a zone that is gone rejects with 404', async () => {
    serve(() => ({ status: 404, data: { code: 'NOT_FOUND' } }))
    await expect(checkIn('o1', 's1', 'z9')).rejects.toMatchObject({ status: 404 })
  })

  it('getCheckInZones: reads the zones of the Site with their floor plan', async () => {
    const seen: HttpRequest[] = []
    const zones = [{ id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }]
    serve(() => ({ status: 200, data: zones }), seen)

    expect(await getCheckInZones('o1', 's 1')).toEqual(zones)
    expect(seen[0].url).toBe('/api/organizations/o1/projects/s%201/attendance/zones')
  })

  it('checkIn: a failure rejects, so the screen can offer a retry', async () => {
    serve(() => ({ status: 500, data: undefined }))
    await expect(checkIn('o1', 's1')).rejects.toBeInstanceOf(ApiError)
  })

  it('getAttendance: reads which rows the caller may remove, and takes a missing flag as not removable', async () => {
    const removable = { ...attendance.people[0], removable: true }
    serve(() => ({ status: 200, data: { ...attendance, people: [removable, attendance.people[0]] } }))

    const result = await getAttendance('o1', 's1')

    expect(result.people.map((person) => person.removable)).toEqual([true, false])
  })

  it('getAttendance: a removable row still carries the zone of its Check-in', async () => {
    const zone = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    const row = { ...attendance.people[0], removable: true, checkIn: { ...ownCheckIn, zone } }
    serve(() => ({ status: 200, data: { ...attendance, people: [row] } }))

    const result = await getAttendance('o1', 's1')

    expect(result.people[0].removable).toBe(true)
    expect(result.people[0].checkIn.zone).toEqual(zone)
  })

  it('removeCheckIn: deletes the Check-in with the CSRF proof and expects no body', async () => {
    const seen: HttpRequest[] = []
    serve(() => ({ status: 204, data: undefined }), seen)

    await removeCheckIn('o1', 's 1', 'c/1')

    const sent = seen.find((req) => req.method === 'delete')
    expect(sent?.url).toBe('/api/organizations/o1/projects/s%201/attendance/check-ins/c%2F1')
    expect(sent?.headers?.['X-XSRF-TOKEN']).toBe('proof')
  })

  it('removeCheckIn: a locked day rejects with the 409 of the backend', async () => {
    serve(() => ({ status: 409, data: { code: 'STATE_CONFLICT' } }))
    await expect(removeCheckIn('o1', 's1', 'c1')).rejects.toMatchObject({ status: 409 })
  })
})

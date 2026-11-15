import { afterEach, describe, expect, it } from 'bun:test'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'
import { checkIn, getAttendance, getCheckInZones, removeCheckIn, rollCall } from '../../../features/attendance/attendanceApi'

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
    expect(result.people[0].checkIn?.recordedBy.name).toBe('Ana Perez')
    expect(result.me.membershipId).toBe('m1')
  })

  it('getAttendance: asks for a past day by its date', async () => {
    const seen: HttpRequest[] = []
    serve(() => ({ status: 200, data: { ...attendance, date: '2026-03-08', today: false } }), seen)

    const result = await getAttendance('o1', 's1', '2026-03-08')

    expect(seen[0].url).toBe('/api/organizations/o1/projects/s1/attendance?date=2026-03-08')
    expect(result.today).toBe(false)
  })

  it('getAttendance: a refused date rejects with the 400 of the backend', async () => {
    serve(() => ({ status: 400, data: { code: 'INVALID_ARGUMENT' } }))
    await expect(getAttendance('o1', 's1', '2999-01-01')).rejects.toMatchObject({ status: 400 })
  })

  it('getAttendance: reads present, absent and unplanned rows with their expected zone', async () => {
    const slabA = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    const people = [
      { membershipId: 'm1', name: 'Ana', avatarUrl: null, state: 'PRESENT', planned: true, expectedZone: slabA, checkIn: ownCheckIn, removable: true },
      { membershipId: 'm2', name: 'Beto', avatarUrl: null, state: 'ABSENT', planned: true, expectedZone: slabA, checkIn: null, removable: false },
      { membershipId: 'm3', name: 'Caro', avatarUrl: null, state: 'UNPLANNED', planned: false, expectedZone: null, checkIn: { ...ownCheckIn, id: 'c3', membershipId: 'm3' }, removable: false },
    ]
    serve(() => ({ status: 200, data: { ...attendance, people, me: { membershipId: 'm2', expectedZone: slabA } } }))

    const result = await getAttendance('o1', 's1')

    expect(result.people.map((p) => p.state)).toEqual(['PRESENT', 'ABSENT', 'UNPLANNED'])
    expect(result.people[0].expectedZone).toEqual(slabA)
    expect(result.people[1].checkIn).toBeNull()
    expect(result.people[2].planned).toBe(false)
    expect(result.people[2].expectedZone).toBeNull()
    expect(result.me.expectedZone).toEqual(slabA)
  })

  it('getAttendance: an answer without the plan fields has nobody planned and no expected zone', async () => {
    serve(() => ({ status: 200, data: attendance }))

    const result = await getAttendance('o1', 's1')

    expect(result.people[0].planned).toBe(false)
    expect(result.people[0].expectedZone).toBeNull()
    expect(result.me.expectedZone).toBeNull()
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

  it('checkIn: sends the absent member and selected zone for a check-in recorded by someone else', async () => {
    const seen: HttpRequest[] = []
    const zone = { id: 'z2', name: 'Slab B', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    serve(() => ({ status: 201, data: { ...ownCheckIn, membershipId: 'm2', zone, recordedBy: { membershipId: 'm1', name: 'Ana Perez' } } }), seen)

    const result = await checkIn('o1', 's1', 'z2', 'm2')

    const post = seen.find((req) => req.method === 'post')
    expect(post?.body).toEqual({ zoneId: 'z2', membershipId: 'm2' })
    expect(result.membershipId).toBe('m2')
    expect(result.recordedBy).toEqual({ membershipId: 'm1', name: 'Ana Perez' })
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

  it('getAttendance: reads whether the caller may check in other people and leaves a missing flag unauthorized', async () => {
    serve(() => ({ status: 200, data: { ...attendance, me: { membershipId: 'm1', canCheckInOthers: true } } }))
    const permitted = await getAttendance('o1', 's1')
    expect(permitted.me.canCheckInOthers).toBe(true)

    serve(() => ({ status: 200, data: attendance }))
    const older = await getAttendance('o1', 's1')
    expect(older.me.canCheckInOthers).toBeUndefined()
  })

  it('getAttendance: reads eligible Crew roll-call rosters and their current Check-ins', async () => {
    const zone = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    const checkIn = { ...ownCheckIn, membershipId: 'm2', recordedBy: { membershipId: 'm1', name: 'Ana Perez' } }
    const crew = {
      crewId: 'crew1',
      name: 'Concrete crew',
      expectedZone: zone,
      members: [
        { membershipId: 'm2', name: 'Beto', checkIn: null },
        { membershipId: 'm3', name: 'Caro', checkIn },
      ],
    }
    serve(() => ({ status: 200, data: { ...attendance, me: { ...attendance.me, rollCallCrews: [crew] } } }))

    const result = await getAttendance('o1', 's1')

    expect(result.me.rollCallCrews).toEqual([crew])
  })

  it('rollCall: posts selected Crew members and zone, then reads all returned Check-ins', async () => {
    const seen: HttpRequest[] = []
    const created = { ...ownCheckIn, membershipId: 'm2', recordedBy: { membershipId: 'm1', name: 'Ana Perez' } }
    serve(() => ({ status: 201, data: [created] }), seen)

    const result = await rollCall('o1', 's 1', 'crew1', ['m2'], null)

    const post = seen.find((req) => req.method === 'post')
    expect(post?.url).toBe('/api/organizations/o1/projects/s%201/attendance/roll-calls')
    expect(post?.headers?.['X-XSRF-TOKEN']).toBe('proof')
    expect(post?.body).toEqual({ crewId: 'crew1', membershipIds: ['m2'], zoneId: null })
    expect(result).toEqual([created])
  })

  it('getAttendance: a removable row still carries the zone of its Check-in', async () => {
    const zone = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
    const row = { ...attendance.people[0], removable: true, checkIn: { ...ownCheckIn, zone } }
    serve(() => ({ status: 200, data: { ...attendance, people: [row] } }))

    const result = await getAttendance('o1', 's1')

    expect(result.people[0].removable).toBe(true)
    expect(result.people[0].checkIn?.zone).toEqual(zone)
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

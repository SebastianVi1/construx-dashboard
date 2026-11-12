import { afterEach, describe, expect, it } from 'bun:test'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'
import { checkIn, getAttendance } from '../../../features/attendance/attendanceApi'

const ownCheckIn = {
  id: 'c1',
  membershipId: 'm1',
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
    expect(post?.body).toEqual({})
    expect(result).toEqual(ownCheckIn)
  })

  it('checkIn: a failure rejects, so the screen can offer a retry', async () => {
    serve(() => ({ status: 500, data: undefined }))
    await expect(checkIn('o1', 's1')).rejects.toBeInstanceOf(ApiError)
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { ApiError, configureHttp, type HttpRequest } from '../../../lib/http'
import { getFloorPlanRoster } from '../../../features/floor-plans/floorPlanRosterApi'

const roster = {
  people: [{ membershipId: 'm1', fullName: 'Ana Perez', avatarUrl: null, roleName: 'Trabajador' }],
  crews: [{ id: 'c1', name: 'Rebar crew', memberCount: 3 }],
  equipment: [{ id: 'e1', type: 'Excavator', identifier: 'EX-01' }],
}

function serve(status: number, data: unknown, seen: HttpRequest[] = []) {
  configureHttp({
    baseUrl: '/api',
    fetcher: async (req) => {
      seen.push(req)
      return { status, data }
    },
  })
}

afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

describe('getFloorPlanRoster', () => {
  it('reads the site roster, not the company members list', async () => {
    const seen: HttpRequest[] = []
    serve(200, roster, seen)
    const result = await getFloorPlanRoster('o 1', 's1')
    expect(seen[0].url).toBe('/api/organizations/o%201/projects/s1/floor-plans/roster')
    expect(result.people[0]).toEqual({ membershipId: 'm1', fullName: 'Ana Perez', avatarUrl: null, roleName: 'Trabajador' })
    expect(result.crews[0].memberCount).toBe(3)
    expect(result.equipment[0].identifier).toBe('EX-01')
  })

  it('rejects with the API error so the panel can show it', async () => {
    serve(403, { code: 'FORBIDDEN' })
    await expect(getFloorPlanRoster('o1', 's1')).rejects.toBeInstanceOf(ApiError)
  })
})

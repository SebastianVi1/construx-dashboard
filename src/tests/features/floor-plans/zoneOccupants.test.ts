import { describe, expect, it } from 'bun:test'
import type { Zone } from '../../../features/floor-plans/zonesApi'
import type { AssignmentData, AssignmentOccupant, Worker } from '../../../features/floor-plans/zoneAssignmentsApi'
import {
  assignmentLabel,
  crewsOf,
  escapeHtml,
  memberName,
  MIN_ZONE_AREA_M2,
  personOf,
  polygonArea,
  parseDropPayload,
  pointInPolygon,
  zoneAtPoint,
  zoneIdsOf,
  zoneOccupants,
} from '../../../features/floor-plans/zoneOccupants'

const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

function zone(id: string, points: [number, number][], areaMSquared: number): Zone {
  return {
    id, floorPlanId: 'fp', name: id, description: null, status: 'NOT_STARTED', points, areaMSquared,
    perimeterMeters: 0, version: 0, createdAt: '', updatedAt: '',
  }
}

const ana: Worker = {
  membershipId: 'm1', fullName: 'Ana', avatarUrl: 'https://s3/ana.png', roleName: 'Worker', crewLeader: false, openTasks: [],
}
const beto: Worker = { ...ana, membershipId: 'm2', fullName: null, avatarUrl: null }

const person = (w: Worker): AssignmentOccupant => ({
  kind: 'PERSON', id: w.membershipId, label: w.fullName, avatarUrl: w.avatarUrl, members: [w], equipment: null,
})
const concrete: AssignmentOccupant = {
  kind: 'CREW', id: 'c1', label: 'Concrete', avatarUrl: null,
  members: [{ ...ana, crewLeader: true }, beto], equipment: null,
}
const emptyCrew: AssignmentOccupant = { ...concrete, id: 'c2', label: 'Night shift', members: [] }
const crane: AssignmentOccupant = {
  kind: 'EQUIPMENT', id: 'e1', label: 'Crane — GR-01', avatarUrl: null, members: [],
  equipment: { type: 'Crane', identifier: 'GR-01' },
}

function assignment(over: Partial<AssignmentData>): AssignmentData {
  return {
    id: 'a', zoneId: 'z1', membershipId: null, crewId: null, equipmentId: null, activity: 'Work',
    startDate: '2026-01-01', endDate: null, shift: 'FULL_DAY', createdAt: '', closedAt: null, occupant: null, ...over,
  }
}

const plan = [
  assignment({ id: 'a1', membershipId: 'm1', occupant: person(ana) }),
  assignment({ id: 'a2', crewId: 'c1', occupant: concrete }),
  assignment({ id: 'a3', equipmentId: 'e1', occupant: crane }),
]

describe('pointInPolygon', () => {
  it('finds points inside and outside', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true)
    expect(pointInPolygon([15, 5], square)).toBe(false)
  })

  it('handles a concave polygon', () => {
    const l: [number, number][] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]
    expect(pointInPolygon([2, 8], l)).toBe(true)
    expect(pointInPolygon([8, 8], l)).toBe(false)
  })
})

describe('zoneAtPoint', () => {
  it('prefers the smallest zone when zones overlap', () => {
    const big = zone('big', square, 100)
    const small = zone('small', [[2, 2], [4, 2], [4, 4], [2, 4]], 4)
    expect(zoneAtPoint([big, small], [3, 3])?.id).toBe('small')
    expect(zoneAtPoint([big, small], [8, 8])?.id).toBe('big')
    expect(zoneAtPoint([big, small], [20, 20])).toBeNull()
  })
})

describe('parseDropPayload', () => {
  it('reads a resource and a reassign drag', () => {
    expect(parseDropPayload('{"type":"membership","id":"m1","name":"Ana"}')).toEqual({ type: 'membership', id: 'm1', name: 'Ana' })
    expect(parseDropPayload('{"assignmentId":"a1","sourceZoneId":"z1","label":"Work"}')).toEqual({
      assignmentId: 'a1', sourceZoneId: 'z1', label: 'Work',
    })
  })

  it('rejects anything else', () => {
    expect(parseDropPayload('')).toBeNull()
    expect(parseDropPayload('not json')).toBeNull()
    expect(parseDropPayload('{"type":"robot","id":"x"}')).toBeNull()
  })
})

describe('zoneOccupants', () => {
  it('draws one figure per person, expanding crews and skipping duplicates', () => {
    const result = zoneOccupants(plan)
    expect(result.z1.map((o) => [o.kind, o.label])).toEqual([
      ['person', 'Ana'],
      ['person', 'Concrete'],
      ['equipment', 'Crane — GR-01'],
    ])
  })

  it('keeps the assignment, resource and named person behind each figure for its bubble', () => {
    const result = zoneOccupants(plan)
    expect(result.z1.map((o) => [o.assignmentId, o.resourceId, o.crewName, o.avatarUrl ?? null])).toEqual([
      ['a1', 'm1', undefined, 'https://s3/ana.png'],
      ['a2', 'm2', 'Concrete', null],
      ['a3', 'e1', undefined, null],
    ])
    expect(result.z1[0].worker?.roleName).toBe('Worker')
    expect(result.z1[2].equipment).toEqual({ type: 'Crane', identifier: 'GR-01' })
  })

  it('draws a crew without members as one figure', () => {
    const result = zoneOccupants([assignment({ id: 'a9', crewId: 'c2', occupant: emptyCrew })])
    expect(result.z1.map((o) => [o.key, o.label, o.crewName])).toEqual([['crew:c2', 'Night shift', 'Night shift']])
  })

  it('groups by zone', () => {
    const result = zoneOccupants([
      assignment({ zoneId: 'z1', membershipId: 'm1', occupant: person(ana) }),
      assignment({ zoneId: 'z2', membershipId: 'm2', occupant: person(beto) }),
    ])
    expect(result.z1).toHaveLength(1)
    expect(result.z2[0].resourceId).toBe('m2')
  })
})

describe('escapeHtml', () => {
  it('escapes markup in names', () => {
    expect(escapeHtml('<b>"Ana" & \'Beto\'</b>')).toBe('&lt;b&gt;&quot;Ana&quot; &amp; &#39;Beto&#39;&lt;/b&gt;')
  })
})

describe('assignmentLabel', () => {
  it('names the person, crew or equipment', () => {
    expect(plan.map(assignmentLabel)).toEqual(['Ana', 'Concrete', 'Crane — GR-01'])
    expect(assignmentLabel(assignment({ membershipId: 'm2', occupant: person(beto) }))).toBe('')
    expect(assignmentLabel(assignment({ membershipId: 'gone' }))).toBe('')
  })
})

describe('personOf', () => {
  it('is the assigned person, never a crew member or equipment', () => {
    expect(plan.map((a) => personOf(a)?.membershipId ?? null)).toEqual(['m1', null, null])
  })
})

describe('memberName', () => {
  it('finds a name anywhere on the plan', () => {
    expect(memberName('m1', plan)).toBe('Ana')
    expect(memberName('m2', plan)).toBe('')
    expect(memberName('nobody', plan)).toBe('')
  })
})

describe('crewsOf', () => {
  it('lists the crews on the plan a person is in, once each, and flags the ones they lead', () => {
    const twice = [...plan, assignment({ id: 'a4', zoneId: 'z2', crewId: 'c1', occupant: concrete })]
    expect(crewsOf('m1', twice)).toEqual([{ name: 'Concrete', leader: true }])
    expect(crewsOf('m2', twice)).toEqual([{ name: 'Concrete', leader: false }])
    expect(crewsOf('nobody', twice)).toEqual([])
  })
})

describe('zoneIdsOf', () => {
  it('finds zones reached directly and through a crew, once each', () => {
    const result = zoneIdsOf('m2', [
      assignment({ zoneId: 'z1', membershipId: 'm2', occupant: person(beto) }),
      assignment({ zoneId: 'z2', crewId: 'c1', occupant: concrete }),
      assignment({ zoneId: 'z1', crewId: 'c1', occupant: concrete }),
      assignment({ zoneId: 'z3', membershipId: 'm1', occupant: person(ana) }),
    ])
    expect(result).toEqual(['z1', 'z2'])
  })
})

describe('polygonArea', () => {
  it('measures a square and a triangle in either winding', () => {
    expect(polygonArea(square)).toBe(100)
    expect(polygonArea([[0, 0], [0, 4], [3, 0]])).toBe(6)
  })

  it('finds no area in a click or a line, which the backend would reject', () => {
    expect(polygonArea([[3, 3], [3, 3], [3, 3], [3, 3]])).toBeLessThan(MIN_ZONE_AREA_M2)
    expect(polygonArea([[0, 0], [5, 0], [10, 0]])).toBeLessThan(MIN_ZONE_AREA_M2)
  })
})

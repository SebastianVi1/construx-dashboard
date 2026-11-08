import { describe, expect, it } from 'bun:test'
import type { Zone } from '../../../features/floor-plans/zonesApi'
import type { AssignmentData } from '../../../features/floor-plans/zoneAssignmentsApi'
import {
  assignmentLabel,
  escapeHtml,
  parseDropPayload,
  pointInPolygon,
  zoneAtPoint,
  zoneOccupants,
} from '../../../features/floor-plans/zoneOccupants'

const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

function zone(id: string, points: [number, number][], areaMSquared: number): Zone {
  return {
    id, floorPlanId: 'fp', name: id, description: null, status: 'NOT_STARTED', points, areaMSquared,
    perimeterMeters: 0, version: 0, createdAt: '', updatedAt: '',
  }
}

function assignment(over: Partial<AssignmentData>): AssignmentData {
  return {
    id: 'a', zoneId: 'z1', membershipId: null, crewId: null, equipmentId: null, activity: 'Work',
    startDate: '2026-01-01', endDate: null, shift: 'FULL_DAY', createdAt: '', closedAt: null, ...over,
  }
}

const directory = {
  members: [
    { membershipId: 'm1', fullName: 'Ana', email: 'ana@x.io' },
    { membershipId: 'm2', fullName: null, email: 'beto@x.io' },
  ],
  crews: [{ id: 'c1', name: 'Concrete', memberMembershipIds: ['m1', 'm2'] }],
  equipment: [{ id: 'e1', type: 'Crane', identifier: 'GR-01' }],
}

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
    const result = zoneOccupants(
      [
        assignment({ id: 'a1', membershipId: 'm1' }),
        assignment({ id: 'a2', crewId: 'c1' }),
        assignment({ id: 'a3', equipmentId: 'e1' }),
      ],
      directory,
    )
    expect(result.z1.map((o) => [o.kind, o.label])).toEqual([
      ['person', 'Ana'],
      ['person', 'beto@x.io · Concrete'],
      ['equipment', 'Crane — GR-01'],
    ])
  })

  it('groups by zone', () => {
    const result = zoneOccupants(
      [assignment({ zoneId: 'z1', membershipId: 'm1' }), assignment({ zoneId: 'z2', membershipId: 'm2' })],
      directory,
    )
    expect(result.z1).toHaveLength(1)
    expect(result.z2[0].label).toBe('beto@x.io')
  })
})

describe('escapeHtml', () => {
  it('escapes markup in names', () => {
    expect(escapeHtml('<b>"Ana" & \'Beto\'</b>')).toBe('&lt;b&gt;&quot;Ana&quot; &amp; &#39;Beto&#39;&lt;/b&gt;')
  })
})

describe('assignmentLabel', () => {
  it('names the person, crew or equipment', () => {
    expect(assignmentLabel(assignment({ membershipId: 'm2' }), directory)).toBe('beto@x.io')
    expect(assignmentLabel(assignment({ crewId: 'c1' }), directory)).toBe('Concrete')
    expect(assignmentLabel(assignment({ equipmentId: 'e1' }), directory)).toBe('Crane — GR-01')
    expect(assignmentLabel(assignment({ membershipId: 'gone' }), directory)).toBe('')
  })
})

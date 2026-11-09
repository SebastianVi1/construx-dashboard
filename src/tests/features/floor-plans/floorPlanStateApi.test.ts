import { describe, expect, it } from 'bun:test'
import { localIsoDate, zoneStateSchema } from '../../../features/floor-plans/floorPlanStateApi'
import { z } from 'zod'

const zone = {
  id: 'z1a2b3c4-0000-0000-0000-000000000001',
  floorPlanId: 'fp1a2b3c-0000-0000-0000-000000000001',
  name: 'Foundation Zone',
  description: null,
  status: 'IN_PROGRESS',
  points: [[0, 0], [1, 0], [1, 1], [0, 1]],
  areaMSquared: 25.0,
  perimeterMeters: 20.0,
  version: 1,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
}

const assignment = {
  id: 'a1a2b3c4-0000-0000-0000-000000000001',
  zoneId: 'z1a2b3c4-0000-0000-0000-000000000001',
  membershipId: 'm1a2b3c4-0000-0000-0000-000000000001',
  crewId: null,
  equipmentId: null,
  activity: 'Foundation pouring',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  shift: 'MORNING',
  createdAt: '2026-11-01T08:00:00Z',
  closedAt: null,
  occupant: {
    kind: 'PERSON',
    id: 'm1a2b3c4-0000-0000-0000-000000000001',
    label: 'Ana Perez',
    avatarUrl: 'https://s3.example/ana.png',
    members: [
      {
        membershipId: 'm1a2b3c4-0000-0000-0000-000000000001',
        fullName: 'Ana Perez',
        avatarUrl: 'https://s3.example/ana.png',
        roleName: 'Trabajador',
        crewLeader: false,
        openTasks: [
          {
            id: 't1', projectId: 'p1', goalId: 'g1', name: 'Pour slab', goalName: 'Structure',
            status: 'TODO', taskRole: 'LEAD', dueAt: '2026-11-15T00:00:00Z',
          },
        ],
      },
    ],
    equipment: null,
  },
}

describe('zoneStateSchema', () => {
  it('parses a valid zone state with assignments', () => {
    const raw = { zone, activeAssignments: [assignment] }
    const result = zoneStateSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.zone.name).toBe('Foundation Zone')
      expect(result.data.activeAssignments).toHaveLength(1)
      expect(result.data.activeAssignments[0].activity).toBe('Foundation pouring')
    }
  })

  it('carries the named occupant with photo and open tasks', () => {
    const result = zoneStateSchema.parse({ zone, activeAssignments: [assignment] })
    const occupant = result.activeAssignments[0].occupant
    expect(occupant?.kind).toBe('PERSON')
    expect(occupant?.label).toBe('Ana Perez')
    expect(occupant?.members[0].avatarUrl).toBe('https://s3.example/ana.png')
    expect(occupant?.members[0].openTasks[0].taskRole).toBe('LEAD')
  })

  it('reads equipment and an occupant-less assignment', () => {
    const equipment = {
      ...assignment,
      membershipId: null,
      equipmentId: 'e1',
      occupant: {
        kind: 'EQUIPMENT', id: 'e1', label: 'Crane — GR-01', avatarUrl: null, members: [],
        equipment: { type: 'Crane', identifier: 'GR-01' },
      },
    }
    const result = zoneStateSchema.parse({ zone, activeAssignments: [equipment, { ...assignment, occupant: null }] })
    expect(result.activeAssignments[0].occupant?.equipment?.identifier).toBe('GR-01')
    expect(result.activeAssignments[1].occupant).toBeNull()
  })

  it('parses a zone state with no assignments', () => {
    const raw = { zone, activeAssignments: [] }
    const result = zoneStateSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activeAssignments).toHaveLength(0)
    }
  })

  it('validates an array of zone states', () => {
    const raw = [{ zone, activeAssignments: [assignment] }]
    const result = z.array(zoneStateSchema).safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
    }
  })
})

describe('localIsoDate', () => {
  it('formats the local calendar day, padded', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

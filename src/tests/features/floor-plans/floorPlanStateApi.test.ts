import { describe, expect, it } from 'bun:test'
import { zoneStateSchema } from '../../../features/floor-plans/floorPlanStateApi'
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

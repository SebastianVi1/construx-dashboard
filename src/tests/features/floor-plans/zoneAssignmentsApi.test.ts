import { describe, expect, it } from 'bun:test'
import { assignmentDataSchema, createAssignmentResponseSchema, shiftSchema } from '../../../features/floor-plans/zoneAssignmentsApi'

describe('shiftSchema', () => {
  it('parses valid shifts', () => {
    expect(shiftSchema.parse('MORNING')).toBe('MORNING')
    expect(shiftSchema.parse('AFTERNOON')).toBe('AFTERNOON')
    expect(shiftSchema.parse('FULL_DAY')).toBe('FULL_DAY')
  })

  it('rejects invalid shift', () => {
    expect(() => shiftSchema.parse('NIGHT')).toThrow()
  })
})

describe('assignmentDataSchema', () => {
  it('parses a full assignment', () => {
    const raw = {
      id: 'assign-1',
      zoneId: 'zone-1',
      membershipId: 'mem-1',
      crewId: null,
      equipmentId: null,
      activity: 'Foundation work',
      startDate: '2025-01-15',
      endDate: null,
      shift: 'MORNING',
      createdAt: '2025-01-10T12:00:00Z',
      closedAt: null,
    }
    const result = assignmentDataSchema.parse(raw)
    expect(result.id).toBe('assign-1')
    expect(result.shift).toBe('MORNING')
    expect(result.membershipId).toBe('mem-1')
    expect(result.crewId).toBeNull()
  })

  it('parses a crew assignment', () => {
    const raw = {
      id: 'assign-2',
      zoneId: 'zone-2',
      membershipId: null,
      crewId: 'crew-1',
      equipmentId: null,
      activity: 'Concrete pour',
      startDate: '2025-02-01',
      endDate: '2025-02-05',
      shift: 'FULL_DAY',
      createdAt: '2025-01-28T09:00:00Z',
      closedAt: null,
    }
    const result = assignmentDataSchema.parse(raw)
    expect(result.crewId).toBe('crew-1')
    expect(result.endDate).toBe('2025-02-05')
  })
})

describe('createAssignmentResponseSchema', () => {
  it('parses response with overlap warning', () => {
    const raw = {
      assignment: {
        id: 'assign-3',
        zoneId: 'zone-3',
        membershipId: 'mem-2',
        crewId: null,
        equipmentId: null,
        activity: 'Rebar placement',
        startDate: '2025-03-01',
        endDate: null,
        shift: 'AFTERNOON',
        createdAt: '2025-02-25T10:00:00Z',
        closedAt: null,
      },
      hasOverlapWarning: true,
    }
    const result = createAssignmentResponseSchema.parse(raw)
    expect(result.hasOverlapWarning).toBe(true)
    expect(result.assignment.shift).toBe('AFTERNOON')
  })

  it('parses response without overlap warning', () => {
    const raw = {
      assignment: {
        id: 'assign-4',
        zoneId: 'zone-4',
        membershipId: null,
        crewId: null,
        equipmentId: 'equip-1',
        activity: 'Excavation',
        startDate: '2025-04-01',
        endDate: null,
        shift: 'MORNING',
        createdAt: '2025-03-30T08:00:00Z',
        closedAt: null,
      },
      hasOverlapWarning: false,
    }
    const result = createAssignmentResponseSchema.parse(raw)
    expect(result.hasOverlapWarning).toBe(false)
    expect(result.assignment.equipmentId).toBe('equip-1')
  })
})

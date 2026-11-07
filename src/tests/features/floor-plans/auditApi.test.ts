import { describe, expect, it } from 'bun:test'
import { auditEventSchema } from '../../../features/floor-plans/auditApi'
import { z } from 'zod'

describe('auditEventSchema', () => {
  it('parses a valid audit event', () => {
    const raw = {
      id: 'e1a2b3c4-0000-0000-0000-000000000001',
      entityType: 'FloorPlanZone',
      entityId: 'z1a2b3c4-0000-0000-0000-000000000001',
      action: 'CREATE',
      actorMembershipId: 'm1a2b3c4-0000-0000-0000-000000000001',
      beforeState: null,
      afterState: '{"name":"Zone A"}',
      occurredAt: '2026-11-01T10:00:00Z',
    }
    const result = auditEventSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe('CREATE')
      expect(result.data.entityType).toBe('FloorPlanZone')
    }
  })

  it('parses an event with null actorMembershipId', () => {
    const raw = {
      id: 'e1a2b3c4-0000-0000-0000-000000000002',
      entityType: 'ZoneAssignment',
      entityId: 'a1a2b3c4-0000-0000-0000-000000000001',
      action: 'CLOSE',
      actorMembershipId: null,
      beforeState: '{"closedAt":null}',
      afterState: '{"closedAt":"2026-11-01T12:00:00Z"}',
      occurredAt: '2026-11-01T12:00:00Z',
    }
    const result = auditEventSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('rejects an unknown action', () => {
    const raw = {
      id: 'e1a2b3c4-0000-0000-0000-000000000003',
      entityType: 'FloorPlanZone',
      entityId: 'z1a2b3c4-0000-0000-0000-000000000001',
      action: 'UNKNOWN_ACTION',
      actorMembershipId: null,
      beforeState: null,
      afterState: null,
      occurredAt: '2026-11-01T10:00:00Z',
    }
    const result = auditEventSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  it('validates an array of audit events', () => {
    const events = [
      {
        id: 'e1a2b3c4-0000-0000-0000-000000000001',
        entityType: 'FloorPlanZone',
        entityId: 'z1a2b3c4-0000-0000-0000-000000000001',
        action: 'UPDATE',
        actorMembershipId: 'm1a2b3c4-0000-0000-0000-000000000001',
        beforeState: '{"name":"Old"}',
        afterState: '{"name":"New"}',
        occurredAt: '2026-11-01T10:00:00Z',
      },
    ]
    const result = z.array(auditEventSchema).safeParse(events)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].action).toBe('UPDATE')
    }
  })
})

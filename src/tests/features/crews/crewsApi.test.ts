import { describe, expect, it } from 'bun:test'
import { crewSchema, equipmentSchema } from '../../../features/crews/crewsApi'

describe('crewSchema', () => {
  const valid = {
    id: 'crew-1',
    organizationId: 'org-1',
    name: 'Foundation Crew',
    leaderMembershipId: 'mem-1',
    memberMembershipIds: ['mem-1', 'mem-2'],
    createdAt: '2026-01-15T10:00:00Z',
  }

  it('parses a valid crew', () => {
    const result = crewSchema.parse(valid)
    expect(result.id).toBe('crew-1')
    expect(result.name).toBe('Foundation Crew')
    expect(result.memberMembershipIds).toHaveLength(2)
  })

  it('rejects missing id', () => {
    expect(() => crewSchema.parse({ ...valid, id: '' })).toThrow()
  })

  it('allows an empty members array', () => {
    const result = crewSchema.parse({ ...valid, memberMembershipIds: [] })
    expect(result.memberMembershipIds).toHaveLength(0)
  })
})

describe('equipmentSchema', () => {
  const valid = {
    id: 'equip-1',
    organizationId: 'org-1',
    type: 'Excavator',
    identifier: 'EX-001',
    dailyCostCents: 50000,
    active: true,
    createdAt: '2026-01-15T10:00:00Z',
  }

  it('parses a valid equipment item', () => {
    const result = equipmentSchema.parse(valid)
    expect(result.type).toBe('Excavator')
    expect(result.dailyCostCents).toBe(50000)
    expect(result.active).toBe(true)
  })

  it('allows null dailyCostCents', () => {
    const result = equipmentSchema.parse({ ...valid, dailyCostCents: null })
    expect(result.dailyCostCents).toBeNull()
  })

  it('parses inactive equipment', () => {
    const result = equipmentSchema.parse({ ...valid, active: false })
    expect(result.active).toBe(false)
  })

  it('rejects missing type', () => {
    expect(() => equipmentSchema.parse({ ...valid, type: '' })).toThrow()
  })
})

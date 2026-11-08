import { describe, expect, it } from 'bun:test'
import {
  floorPlanSchema,
  floorPlanUploadTicketSchema,
  viewUrlExpiresSoon,
  type FloorPlan,
} from '../../../features/floor-plans/floorPlansApi'

const baseFloorPlan: FloorPlan = {
  id: 'fp-1',
  projectId: 'proj-1',
  name: 'Ground Floor',
  description: null,
  level: 'Ground',
  pageNumber: 1,
  status: 'READY',
  errorReason: null,
  viewUrl: 'https://example.com/signed-url',
  viewUrlExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  createdAt: '2026-11-01T10:00:00Z',
  completedAt: '2026-11-01T10:01:00Z',
}

describe('floorPlanSchema', () => {
  it('parses a READY floor plan', () => {
    const result = floorPlanSchema.safeParse(baseFloorPlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('fp-1')
      expect(result.data.status).toBe('READY')
    }
  })

  it('parses a PENDING floor plan', () => {
    const result = floorPlanSchema.safeParse({ ...baseFloorPlan, status: 'PENDING', viewUrl: null, viewUrlExpiresAt: null, completedAt: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.status).toBe('PENDING')
  })

  it('parses a PROCESSING floor plan', () => {
    const result = floorPlanSchema.safeParse({ ...baseFloorPlan, status: 'PROCESSING', viewUrl: null, viewUrlExpiresAt: null, completedAt: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.status).toBe('PROCESSING')
  })

  it('parses an ERROR floor plan with reason', () => {
    const result = floorPlanSchema.safeParse({
      ...baseFloorPlan,
      status: 'ERROR',
      viewUrl: null,
      viewUrlExpiresAt: null,
      errorReason: 'Page 5 is out of range; this PDF has 2 page(s)',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('ERROR')
      expect(result.data.errorReason).toBe('Page 5 is out of range; this PDF has 2 page(s)')
    }
  })

  it('rejects an unknown status', () => {
    const result = floorPlanSchema.safeParse({ ...baseFloorPlan, status: 'UNKNOWN' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing id', () => {
    const { id: _id, ...rest } = baseFloorPlan // eslint-disable-line @typescript-eslint/no-unused-vars
    const result = floorPlanSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('allows nullable optional fields', () => {
    const result = floorPlanSchema.safeParse({
      ...baseFloorPlan,
      description: null,
      level: null,
      errorReason: null,
      viewUrl: null,
      viewUrlExpiresAt: null,
      completedAt: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('floorPlanUploadTicketSchema', () => {
  it('parses a valid upload ticket', () => {
    const ticket = {
      floorPlanId: 'fp-new',
      uploadUrl: 'https://s3.example.com/presigned',
      headers: { 'Content-Type': 'application/pdf', 'Content-Length': '102400' },
      expiresAt: '2026-11-01T10:10:00Z',
    }
    const result = floorPlanUploadTicketSchema.safeParse(ticket)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.floorPlanId).toBe('fp-new')
  })

  it('rejects an empty floorPlanId', () => {
    const result = floorPlanUploadTicketSchema.safeParse({ floorPlanId: '', uploadUrl: 'https://x', headers: {}, expiresAt: '2026-11-01' })
    expect(result.success).toBe(false)
  })
})

describe('viewUrlExpiresSoon', () => {
  it('returns false when expires in more than 5 minutes', () => {
    const fp: FloorPlan = { ...baseFloorPlan, viewUrlExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }
    expect(viewUrlExpiresSoon(fp)).toBe(false)
  })

  it('returns true when expires in less than 5 minutes', () => {
    const fp: FloorPlan = { ...baseFloorPlan, viewUrlExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString() }
    expect(viewUrlExpiresSoon(fp)).toBe(true)
  })

  it('returns false when viewUrlExpiresAt is null', () => {
    const fp: FloorPlan = { ...baseFloorPlan, viewUrlExpiresAt: null }
    expect(viewUrlExpiresSoon(fp)).toBe(false)
  })
})

import { describe, expect, it } from 'bun:test'
import { zoneSchema, computeZoneArea, computeZonePerimeter } from '../../../features/floor-plans/zonesApi'

describe('zoneSchema', () => {
  it('parses a valid zone', () => {
    const raw = {
      id: 'abc',
      floorPlanId: 'fp1',
      name: 'Zone A',
      description: null,
      status: 'NOT_STARTED',
      points: [[0, 0], [10, 0], [10, 10], [0, 10]],
      areaMSquared: 100,
      perimeterMeters: 40,
      version: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    const zone = zoneSchema.parse(raw)
    expect(zone.name).toBe('Zone A')
    expect(zone.status).toBe('NOT_STARTED')
    expect(zone.points.length).toBe(4)
  })

  it('rejects invalid status', () => {
    expect(() =>
      zoneSchema.parse({
        id: 'x', floorPlanId: 'fp', name: 'Z', description: null,
        status: 'INVALID', points: [], areaMSquared: 0, perimeterMeters: 0,
        version: 0, createdAt: '', updatedAt: '',
      })
    ).toThrow()
  })
})

describe('computeZoneArea', () => {
  it('computes 10×10 square = 100 m²', () => {
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    expect(computeZoneArea(pts)).toBeCloseTo(100, 9)
  })

  it('computes right triangle 3-4 = 6 m²', () => {
    const pts: [number, number][] = [[0, 0], [3, 0], [0, 4]]
    expect(computeZoneArea(pts)).toBeCloseTo(6, 9)
  })

  it('returns 0 for fewer than 3 points', () => {
    expect(computeZoneArea([[0, 0], [1, 0]])).toBe(0)
  })
})

describe('computeZonePerimeter', () => {
  it('computes 10×10 square = 40 m', () => {
    const pts: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    expect(computeZonePerimeter(pts)).toBeCloseTo(40, 9)
  })

  it('computes right triangle 3-4-5 = 12 m', () => {
    const pts: [number, number][] = [[0, 0], [3, 0], [0, 4]]
    expect(computeZonePerimeter(pts)).toBeCloseTo(12, 9)
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { calibrationSchema, computeMetersPerPx, findCalibration } from '../../../features/floor-plans/calibrationApi'
import { ApiError, configureHttp } from '../../../lib/http'

describe('computeMetersPerPx', () => {
  it('computes correctly for horizontal distance (100 px, 5 m → 0.05)', () => {
    expect(computeMetersPerPx(0, 0, 100, 0, 5.0)).toBeCloseTo(0.05, 10)
  })

  it('computes correctly for a 3-4-5 triangle (5 px distance, 10 m → 2)', () => {
    expect(computeMetersPerPx(0, 0, 3, 4, 10.0)).toBeCloseTo(2.0, 10)
  })

  it('computes correctly for vertical distance (50 px, 2.5 m → 0.05)', () => {
    expect(computeMetersPerPx(10, 10, 10, 60, 2.5)).toBeCloseTo(0.05, 10)
  })

  it('returns Infinity when points are identical', () => {
    expect(computeMetersPerPx(5, 5, 5, 5, 3.0)).toBe(Infinity)
  })
})

describe('calibrationSchema', () => {
  const validData = {
    id: 'abc-123',
    floorPlanId: 'fp-456',
    metersPerPx: 0.05,
    pointAX: 0,
    pointAY: 0,
    pointBX: 100,
    pointBY: 0,
    lengthMeters: 5.0,
    createdAt: '2026-11-01T12:00:00Z',
  }

  it('parses valid calibration data', () => {
    const result = calibrationSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metersPerPx).toBe(0.05)
      expect(result.data.floorPlanId).toBe('fp-456')
    }
  })

  it('rejects missing id', () => {
    const { id: _id, ...rest } = validData // eslint-disable-line @typescript-eslint/no-unused-vars
    const result = calibrationSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric metersPerPx', () => {
    const result = calibrationSchema.safeParse({ ...validData, metersPerPx: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects empty floorPlanId', () => {
    const result = calibrationSchema.safeParse({ ...validData, floorPlanId: '' })
    expect(result.success).toBe(false)
  })
})

describe('findCalibration', () => {
  const saved = {
    id: 'c1', floorPlanId: 'fp1', metersPerPx: 0.05,
    pointAX: 0, pointAY: 0, pointBX: 100, pointBY: 0, lengthMeters: 5, createdAt: '2026-11-01T12:00:00Z',
  }
  const answer = (status: number, data: unknown) =>
    configureHttp({ baseUrl: '/api', fetcher: async () => ({ status, data }) })

  afterEach(() => configureHttp({ fetcher: async () => ({ status: 599, data: undefined }) }))

  it('returns the saved calibration', async () => {
    answer(200, saved)
    expect(await findCalibration('o1', 's1', 'fp1')).toEqual(saved)
  })

  it('returns null for a plan nobody has calibrated yet', async () => {
    answer(404, { code: 'NOT_FOUND' })
    expect(await findCalibration('o1', 's1', 'fp1')).toBeNull()
  })

  it('fails on any other error instead of passing the plan off as uncalibrated', async () => {
    answer(500, undefined)
    const error = await findCalibration('o1', 's1', 'fp1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })
})

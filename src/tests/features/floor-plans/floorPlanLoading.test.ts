import { describe, expect, it } from 'bun:test'
import { applyZoneChange, floorPlanLoadKeys, nextPollDelay, refreshOnReturn } from '../../../features/floor-plans/floorPlanLoading'
import type { FloorPlan } from '../../../features/floor-plans/floorPlansApi'

const NOW = Date.parse('2026-11-09T12:00:00Z')

function plan(overrides: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'fp1',
    projectId: 'p1',
    name: 'Ground floor',
    description: null,
    level: null,
    pageNumber: 1,
    status: 'READY',
    errorReason: null,
    viewUrl: 'https://s3.example/fp1.png',
    viewUrlExpiresAt: '2026-11-09T13:00:00Z',
    createdAt: '2026-11-01T08:00:00Z',
    completedAt: '2026-11-01T08:01:00Z',
    ...overrides,
  }
}

describe('nextPollDelay', () => {
  it('polls every 3 seconds while the plan is pending or processing', () => {
    expect(nextPollDelay(plan({ status: 'PENDING', viewUrl: null, viewUrlExpiresAt: null }), NOW)).toBe(3000)
    expect(nextPollDelay(plan({ status: 'PROCESSING', viewUrl: null, viewUrlExpiresAt: null }), NOW)).toBe(3000)
  })

  it('refreshes a ready plan 5 minutes before its view URL expires', () => {
    // expires 13:00, refresh at 12:55 → 55 minutes from now
    expect(nextPollDelay(plan(), NOW)).toBe(55 * 60 * 1000)
  })

  it('does not hammer the API when the fresh URL already expires soon', () => {
    expect(nextPollDelay(plan({ viewUrlExpiresAt: '2026-11-09T12:02:00Z' }), NOW)).toBe(30_000)
  })

  it('stops when there is nothing to wait for', () => {
    expect(nextPollDelay(plan({ viewUrlExpiresAt: null }), NOW)).toBeNull()
    expect(nextPollDelay(plan({ status: 'ERROR', viewUrl: null, viewUrlExpiresAt: null }), NOW)).toBeNull()
    expect(nextPollDelay(undefined, NOW)).toBeNull()
  })
})

describe('refreshOnReturn', () => {
  it('reloads a plan whose view URL expired or is about to while the tab was hidden', () => {
    expect(refreshOnReturn(plan({ viewUrlExpiresAt: '2026-11-09T11:00:00Z' }), NOW)).toBe(true)
    expect(refreshOnReturn(plan({ viewUrlExpiresAt: '2026-11-09T12:04:00Z' }), NOW)).toBe(true)
  })

  it('keeps a URL that is still good', () => {
    expect(refreshOnReturn(plan(), NOW)).toBe(false)
    expect(refreshOnReturn(plan({ viewUrlExpiresAt: null }), NOW)).toBe(false)
    expect(refreshOnReturn(undefined, NOW)).toBe(false)
  })

  it('checks a rendering plan right away instead of waiting for the next poll', () => {
    expect(refreshOnReturn(plan({ status: 'PROCESSING', viewUrl: null, viewUrlExpiresAt: null }), NOW)).toBe(true)
  })
})

describe('floorPlanLoadKeys', () => {
  const calibration = {
    id: 'c1', floorPlanId: 'fp1', metersPerPx: 0.01,
    pointAX: 0, pointAY: 0, pointBX: 100, pointBY: 0, lengthMeters: 1, createdAt: '2026-11-01T08:00:00Z',
  }

  it('reads only the plan until it is ready', () => {
    expect(floorPlanLoadKeys('o1', 's1', 'fp1', undefined, undefined)).toEqual({
      plan: 'o1:s1:fp1', calibration: null, state: null,
    })
    expect(floorPlanLoadKeys('o1', 's1', 'fp1', plan({ status: 'PROCESSING' }), undefined)).toEqual({
      plan: 'o1:s1:fp1', calibration: null, state: null,
    })
  })

  it('reads the calibration of a ready plan, and zones only once it is calibrated', () => {
    expect(floorPlanLoadKeys('o1', 's1', 'fp1', plan(), undefined)).toEqual({
      plan: 'o1:s1:fp1', calibration: 'o1:s1:fp1', state: null,
    })
    expect(floorPlanLoadKeys('o1', 's1', 'fp1', plan(), null).state).toBeNull()
    expect(floorPlanLoadKeys('o1', 's1', 'fp1', plan(), calibration).state).toBe('o1:s1:fp1')
  })

  it('gives another plan or Site its own keys, so nothing of the old one is shown', () => {
    expect(floorPlanLoadKeys('o1', 's1', 'fp2', plan(), calibration).plan).toBe('o1:s1:fp2')
    expect(floorPlanLoadKeys('o1', 's2', 'fp1', plan(), calibration).state).toBe('o1:s2:fp1')
  })

  it('loads nothing before the company and route are known', () => {
    expect(floorPlanLoadKeys('', 's1', 'fp1', undefined, undefined).plan).toBeNull()
    expect(floorPlanLoadKeys('o1', 's1', '', undefined, undefined).plan).toBeNull()
  })
})

describe('applyZoneChange', () => {
  function zone(id: string, name = id) {
    return {
      id, floorPlanId: 'fp1', name, description: null, status: 'NOT_STARTED' as const,
      points: [[0, 0], [1, 0], [1, 1]] as [number, number][], areaMSquared: 1, perimeterMeters: 3, version: 1,
      createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z',
    }
  }
  const occupied = { id: 'a1' } as never
  const states = [
    { zone: zone('z1', 'Slab'), activeAssignments: [occupied] },
    { zone: zone('z2'), activeAssignments: [] },
  ]

  it('adds a drawn zone with nobody in it', () => {
    const next = applyZoneChange(states, { kind: 'created', zone: zone('z3') })
    expect(next.map((s) => s.zone.id)).toEqual(['z1', 'z2', 'z3'])
    expect(next[2]!.activeAssignments).toEqual([])
  })

  it('replaces an edited zone and keeps its occupants', () => {
    const next = applyZoneChange(states, { kind: 'updated', zone: { ...zone('z1'), name: 'Slab B', version: 2 } })
    expect(next[0]!.zone.name).toBe('Slab B')
    expect(next[0]!.activeAssignments).toEqual([occupied])
    expect(next[1]).toBe(states[1]!)
  })

  it('drops a deleted zone with its occupants', () => {
    expect(applyZoneChange(states, { kind: 'deleted', zoneId: 'z1' }).map((s) => s.zone.id)).toEqual(['z2'])
  })
})

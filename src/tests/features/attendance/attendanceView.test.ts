import { describe, expect, it } from 'bun:test'
import type { Attendance, AttendancePerson, CheckIn, ZoneRef } from '../../../features/attendance/attendanceApi'
import { ApiError } from '../../../lib/http'
import {
  NO_ZONE,
  canRemove,
  checkInTime,
  currentCheckIn,
  inGoneZone,
  myCheckIn,
  pendingCheckIn,
  recordedBySelf,
  removalFailure,
  staysPut,
  zoneChoice,
  zonesByFloorPlan,
} from '../../../features/attendance/attendanceView'

function person(membershipId: string, recorderId = membershipId, removable = false): AttendancePerson {
  return {
    membershipId,
    name: `Person ${membershipId}`,
    avatarUrl: null,
    state: 'PRESENT',
    removable,
    checkIn: {
      id: `c-${membershipId}`,
      membershipId,
      zone: null,
      date: '2026-03-10',
      checkedInAt: '2026-03-10T15:05:00Z',
      recordedBy: { membershipId: recorderId, name: `Person ${recorderId}` },
    },
  }
}

function attendance(me: string, people: AttendancePerson[], today = true): Attendance {
  return { date: '2026-03-10', today, people, me: { membershipId: me } }
}

const slabA: ZoneRef = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
const slabB: ZoneRef = { id: 'z2', name: 'Slab B', floorPlanId: 'p1', floorPlanName: 'Level 1' }

function made(id: string, checkedInAt: string, zone: ZoneRef | null): CheckIn {
  return { id, membershipId: 'm1', zone, date: '2026-03-10', checkedInAt, recordedBy: { membershipId: 'm1', name: 'Ana' } }
}

describe('attendance view', () => {
  it('myCheckIn: finds the Check-in of the caller among the people present', () => {
    expect(myCheckIn(attendance('m2', [person('m1'), person('m2')]))?.id).toBe('c-m2')
  })

  it('myCheckIn: is null while the caller has not checked in or nothing is loaded', () => {
    expect(myCheckIn(attendance('m3', [person('m1')]))).toBeNull()
    expect(myCheckIn(undefined)).toBeNull()
  })

  it('myCheckIn: a Check-in of another day does not count as checked in today', () => {
    expect(myCheckIn(attendance('m1', [person('m1')], false))).toBeNull()
  })

  it('recordedBySelf: tells a self Check-in from one recorded by someone else', () => {
    expect(recordedBySelf(person('m1'))).toBe(true)
    expect(recordedBySelf(person('m1', 'm9'))).toBe(false)
  })

  it('currentCheckIn: a move just made wins over the older Check-in still loaded', () => {
    const loaded = attendance('m1', [person('m1')])
    const moved = made('c-new', '2026-03-10T17:00:00Z', slabA)
    expect(currentCheckIn(loaded, moved)?.id).toBe('c-new')
  })

  it('currentCheckIn: the loaded Check-in wins once it is the later one', () => {
    const loaded = attendance('m1', [person('m1')])
    expect(currentCheckIn(loaded, made('c-old', '2026-03-10T14:00:00Z', null))?.id).toBe('c-m1')
    expect(currentCheckIn(loaded, null)?.id).toBe('c-m1')
  })

  it('currentCheckIn: a Check-in just made shows before Attendance has loaded it', () => {
    const moved = made('c-new', '2026-03-10T17:00:00Z', slabA)
    expect(currentCheckIn(undefined, moved)?.id).toBe('c-new')
    expect(currentCheckIn(attendance('m1', []), moved)?.id).toBe('c-new')
  })

  it('currentCheckIn: a Check-in made on an earlier day is dropped when the day has moved on', () => {
    const nextDay: Attendance = { date: '2026-03-11', today: true, people: [], me: { membershipId: 'm1' } }
    expect(currentCheckIn(nextDay, made('c-new', '2026-03-10T17:00:00Z', slabA))).toBeNull()
  })

  it('pendingCheckIn: a Check-in just made counts only until Attendance is loaded again', () => {
    const before = attendance('m1', [person('m1')])
    const moved = made('c-new', '2026-03-10T17:00:00Z', slabB)
    expect(pendingCheckIn({ checkIn: moved, before }, before)?.id).toBe('c-new')
    expect(pendingCheckIn({ checkIn: moved, before: undefined }, undefined)?.id).toBe('c-new')
    expect(pendingCheckIn({ checkIn: moved, before }, attendance('m1', [person('m1')]))).toBeNull()
    expect(pendingCheckIn(null, before)).toBeNull()
  })

  it('a removed Check-in just made stops showing: the person is back in their previous Check-in', () => {
    const before = attendance('m1', [person('m1')])
    const moved = { checkIn: made('c-new', '2026-03-10T17:00:00Z', slabB), before }
    expect(currentCheckIn(before, pendingCheckIn(moved, before))?.id).toBe('c-new')
    // The move was removed and Attendance reloaded: it answers the earlier Check-in again.
    const reloaded = attendance('m1', [person('m1')])
    expect(currentCheckIn(reloaded, pendingCheckIn(moved, reloaded))?.id).toBe('c-m1')
    // The only Check-in was removed: not checked in any more.
    const empty = attendance('m1', [])
    expect(currentCheckIn(empty, pendingCheckIn(moved, empty))).toBeNull()
  })

  it('zonesByFloorPlan: groups the zones under their floor plan, in the order received', () => {
    const ramp: ZoneRef = { id: 'z3', name: 'Ramp', floorPlanId: 'p2', floorPlanName: 'Basement' }
    expect(zonesByFloorPlan([ramp, slabA, slabB])).toEqual([
      { floorPlanId: 'p2', floorPlanName: 'Basement', zones: [ramp] },
      { floorPlanId: 'p1', floorPlanName: 'Level 1', zones: [slabA, slabB] },
    ])
    expect(zonesByFloorPlan([])).toEqual([])
  })

  it('zoneChoice: starts on the zone the person is in, or on "No zone"', () => {
    expect(zoneChoice(null)).toBe(NO_ZONE)
    expect(zoneChoice(made('c1', '2026-03-10T15:00:00Z', null))).toBe(NO_ZONE)
    expect(zoneChoice(made('c1', '2026-03-10T15:00:00Z', slabA))).toBe('z1')
  })

  it('staysPut: only the place the person is already in changes nothing', () => {
    const inSlabA = made('c1', '2026-03-10T15:00:00Z', slabA)
    expect(staysPut(inSlabA, 'z1')).toBe(true)
    expect(staysPut(inSlabA, 'z2')).toBe(false)
    expect(staysPut(inSlabA, NO_ZONE)).toBe(false)
    expect(staysPut(made('c1', '2026-03-10T15:00:00Z', null), NO_ZONE)).toBe(true)
    expect(staysPut(null, NO_ZONE)).toBe(false)
  })

  it('inGoneZone: tells when the person is in a zone that can no longer be picked', () => {
    const inSlabA = made('c1', '2026-03-10T15:00:00Z', slabA)
    expect(inGoneZone(inSlabA, [slabB])).toBe(true)
    expect(inGoneZone(inSlabA, [slabA, slabB])).toBe(false)
    expect(inGoneZone(made('c1', '2026-03-10T15:00:00Z', null), [])).toBe(false)
    expect(inGoneZone(null, [])).toBe(false)
  })

  it('checkInTime: shows the moment as a clock time in the given zone', () => {
    expect(checkInTime('2026-03-10T15:05:00Z', 'en-US', 'America/Mexico_City')).toBe('9:05 AM')
    expect(checkInTime('2026-03-10T15:05:00Z', 'es-MX', 'UTC')).toMatch(/3:05/)
  })

  it('canRemove: offers removal on the rows the backend marks removable', () => {
    const mine = person('m1', 'm1', true)
    const theirs = person('m2')
    const today = attendance('m1', [mine, theirs])

    expect(canRemove(today, mine)).toBe(true)
    expect(canRemove(today, theirs)).toBe(false)
  })

  it('canRemove: a past day shows no removal action, whatever the row says', () => {
    const mine = person('m1', 'm1', true)
    expect(canRemove(attendance('m1', [mine], false), mine)).toBe(false)
  })

  it('removalFailure: tells a locked day and a missing right from any other failure', () => {
    expect(removalFailure(new ApiError(409))).toBe('locked')
    expect(removalFailure(new ApiError(403))).toBe('forbidden')
    expect(removalFailure(new ApiError(500))).toBe('failed')
    expect(removalFailure(new Error('offline'))).toBe('failed')
  })
})

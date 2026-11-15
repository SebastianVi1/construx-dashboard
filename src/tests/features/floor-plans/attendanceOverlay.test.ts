import { describe, expect, it } from 'bun:test'
import type { Attendance, AttendancePerson, CheckIn, ZoneRef } from '../../../features/attendance/attendanceApi'
import type { Occupant } from '../../../features/floor-plans/zoneOccupants'
import { attendanceLabel, overlayAttendance } from '../../../features/floor-plans/attendanceOverlay'

const TODAY = '2026-03-10'

const slabA: ZoneRef = { id: 'z1', name: 'Slab A', floorPlanId: 'p1', floorPlanName: 'Level 1' }
const slabB: ZoneRef = { id: 'z2', name: 'Slab B', floorPlanId: 'p1', floorPlanName: 'Level 1' }
const upper: ZoneRef = { id: 'z9', name: 'Loft', floorPlanId: 'p2', floorPlanName: 'Level 2' }

const zones = [{ id: slabA.id }, { id: slabB.id }]

const ana = person('m1', 'Ana')
const beto = person('m2', 'Beto')

function person(membershipId: string, name: string): Occupant {
  return {
    key: `person:${membershipId}`,
    kind: 'person',
    label: name,
    assignmentId: `a-${membershipId}`,
    resourceId: membershipId,
    avatarUrl: null,
  }
}

const crane: Occupant = {
  key: 'equipment:e1',
  kind: 'equipment',
  label: 'Crane — GR-01',
  assignmentId: 'a-e1',
  resourceId: 'e1',
  equipment: { type: 'Crane', identifier: 'GR-01' },
}

const plan: Record<string, Occupant[]> = { z1: [ana], z2: [beto, crane] }

function checkIn(zone: ZoneRef | null): CheckIn {
  return {
    id: 'c1',
    membershipId: 'm1',
    zone,
    date: TODAY,
    checkedInAt: `${TODAY}T15:05:00Z`,
    recordedBy: { membershipId: 'm1', name: 'Ana' },
  }
}

function attendancePerson(over: Partial<AttendancePerson>): AttendancePerson {
  return {
    membershipId: 'm1',
    name: 'Ana',
    avatarUrl: null,
    state: 'PRESENT',
    planned: true,
    expectedZone: slabA,
    checkIn: checkIn(slabA),
    removable: false,
    ...over,
  }
}

function attendance(people: AttendancePerson[], over: Partial<Attendance> = {}): Attendance {
  return { date: TODAY, today: true, people, me: { membershipId: 'm1', expectedZone: slabA }, ...over }
}

const states = { PRESENT: 'Present', ABSENT: 'Absent', UNPLANNED: 'Unplanned' }

describe('attendanceLabel', () => {
  it('says a person is absent', () => {
    expect(attendanceLabel('Ana', 'ABSENT', states)).toBe('Ana · Absent')
  })

  it('says a person was not planned', () => {
    expect(attendanceLabel('Ana', 'UNPLANNED', states)).toBe('Ana · Unplanned')
  })

  it('leaves a present person and the plan without Attendance alone', () => {
    expect(attendanceLabel('Ana', 'PRESENT', states)).toBe('Ana')
    expect(attendanceLabel('Ana', undefined, states)).toBe('Ana')
  })
})

describe('overlayAttendance', () => {  it('leaves the plan alone when Attendance has not loaded', () => {
    expect(overlayAttendance(plan, undefined, TODAY, zones)).toEqual(plan)
  })

  it('leaves the plan alone when Attendance is of another day than the browser', () => {
    const data = attendance([attendancePerson({ state: 'ABSENT', checkIn: null })], { date: '2026-03-11' })
    expect(overlayAttendance(plan, data, TODAY, zones)).toEqual(plan)
  })

  it('leaves the plan alone when Attendance is not today', () => {
    const data = attendance([attendancePerson({ state: 'ABSENT', checkIn: null })], { today: false })
    expect(overlayAttendance(plan, data, TODAY, zones)).toEqual(plan)
  })

  it('draws an expected person who is present solid in their zone', () => {
    const result = overlayAttendance(plan, attendance([attendancePerson({})]), TODAY, zones)
    expect(result.z1).toEqual([{ ...ana, attendance: 'PRESENT' }])
    expect(result.z2).toEqual(plan.z2 ?? [])
  })

  it('draws an expected person who is absent dimmed in their expected zone', () => {
    const data = attendance([attendancePerson({ state: 'ABSENT', checkIn: null })])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([{ ...ana, attendance: 'ABSENT' }])
  })

  it('moves a person to the zone they checked in to, marked unplanned', () => {
    const data = attendance([attendancePerson({ checkIn: checkIn(slabB) })])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([])
    expect(result.z2?.map((o) => o.resourceId)).toEqual(['m2', 'e1', 'm1'])
    expect(result.z2?.find((o) => o.resourceId === 'm1')).toEqual({ ...ana, attendance: 'UNPLANNED' })
  })

  it('does not draw an expected person who checked in with no zone', () => {
    const data = attendance([attendancePerson({ checkIn: checkIn(null) })])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([])
    expect(result.z2).toEqual(plan.z2 ?? [])
  })

  it('does not draw an expected person who checked in on another floor plan', () => {
    const data = attendance([attendancePerson({ checkIn: checkIn(upper) })])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([])
    expect(result.z2).toEqual(plan.z2 ?? [])
  })

  it('draws someone who checked in here without being planned, marked unplanned', () => {
    const data = attendance([
      attendancePerson({
        membershipId: 'm3',
        name: 'Carla',
        avatarUrl: 'https://s3/carla.png',
        state: 'UNPLANNED',
        planned: false,
        expectedZone: null,
        checkIn: { ...checkIn(slabB), membershipId: 'm3', recordedBy: { membershipId: 'm3', name: 'Carla' } },
      }),
    ])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([ana])
    expect(result.z2?.at(-1)).toEqual({
      key: 'person:m3',
      kind: 'person',
      label: 'Carla',
      resourceId: 'm3',
      avatarUrl: 'https://s3/carla.png',
      attendance: 'UNPLANNED',
    })
  })

  it('marks a Check-in without a plan as unplanned even inside a zone', () => {
    const data = attendance([
      attendancePerson({ state: 'UNPLANNED', planned: false, expectedZone: null }),
    ])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([{ ...ana, attendance: 'UNPLANNED' }])
  })

  it('leaves the plan alone for someone expected on another floor plan', () => {
    const data = attendance([attendancePerson({ state: 'ABSENT', checkIn: null, expectedZone: upper })])
    expect(overlayAttendance(plan, data, TODAY, zones)).toEqual({ z1: [], z2: plan.z2 })
  })

  it('draws an expected person who is absent even when the plan state omits them', () => {
    const data = attendance([attendancePerson({ state: 'ABSENT', checkIn: null })])
    const result = overlayAttendance({ z1: [], z2: [crane] }, data, TODAY, zones)
    expect(result.z1).toEqual([
      {
        key: 'person:m1',
        kind: 'person',
        label: 'Ana',
        resourceId: 'm1',
        avatarUrl: null,
        attendance: 'ABSENT',
      },
    ])
  })

  it('does not invent figures for people Attendance does not list', () => {
    const data = attendance([
      attendancePerson({
        membershipId: 'm2',
        name: 'Beto',
        expectedZone: slabB,
        checkIn: { ...checkIn(slabB), membershipId: 'm2' },
      }),
    ])
    const result = overlayAttendance(plan, data, TODAY, zones)
    expect(result.z1).toEqual([ana])
  })
})

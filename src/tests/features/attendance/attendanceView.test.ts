import { describe, expect, it } from 'bun:test'
import type { Attendance, AttendancePerson } from '../../../features/attendance/attendanceApi'
import { checkInTime, myCheckIn, recordedBySelf } from '../../../features/attendance/attendanceView'

function person(membershipId: string, recorderId = membershipId): AttendancePerson {
  return {
    membershipId,
    name: `Person ${membershipId}`,
    avatarUrl: null,
    state: 'PRESENT',
    checkIn: {
      id: `c-${membershipId}`,
      membershipId,
      date: '2026-03-10',
      checkedInAt: '2026-03-10T15:05:00Z',
      recordedBy: { membershipId: recorderId, name: `Person ${recorderId}` },
    },
  }
}

function attendance(me: string, people: AttendancePerson[], today = true): Attendance {
  return { date: '2026-03-10', today, people, me: { membershipId: me } }
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

  it('checkInTime: shows the moment as a clock time in the given zone', () => {
    expect(checkInTime('2026-03-10T15:05:00Z', 'en-US', 'America/Mexico_City')).toBe('9:05 AM')
    expect(checkInTime('2026-03-10T15:05:00Z', 'es-MX', 'UTC')).toMatch(/3:05/)
  })
})

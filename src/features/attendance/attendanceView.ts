import { ApiError } from '../../lib/http'
import type { Attendance, AttendancePerson, CheckIn } from './attendanceApi'

/** The caller's Check-in of today, or null when they have none (or Attendance is not loaded or not today's). */
export function myCheckIn(attendance: Attendance | undefined): CheckIn | null {
  if (!attendance?.today) return null
  return attendance.people.find((person) => person.membershipId === attendance.me.membershipId)?.checkIn ?? null
}

/** True when the person checked themselves in, false when someone answered for them. */
export function recordedBySelf(person: AttendancePerson): boolean {
  return person.checkIn.recordedBy.membershipId === person.membershipId
}

/** The moment of a Check-in as a clock time; in the browser's zone unless one is given. */
export function checkInTime(checkedInAt: string, intlLocale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(intlLocale, { hour: 'numeric', minute: '2-digit', timeZone }).format(
    new Date(checkedInAt),
  )
}

/** Where the Attendance page of a Site lives. */
export function attendanceUrl(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}/attendance`
}

/** Whether the row offers "Remove": only on today's Attendance, on the rows the backend marks removable. */
export function canRemove(attendance: Attendance, person: AttendancePerson): boolean {
  return attendance.today && person.removable
}

export type RemovalFailure = 'locked' | 'forbidden' | 'failed'

/** Why a removal was refused: the day is over (409), the caller lacks the right (403), or anything else. */
export function removalFailure(error: unknown): RemovalFailure {
  const status = error instanceof ApiError ? error.status : undefined
  if (status === 409) return 'locked'
  if (status === 403) return 'forbidden'
  return 'failed'
}

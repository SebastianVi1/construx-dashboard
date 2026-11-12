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

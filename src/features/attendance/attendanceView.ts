import { ApiError } from '../../lib/http'
import type { Attendance, AttendancePerson, CheckIn, ZoneRef } from './attendanceApi'

/** The caller's Check-in of today, or null when they have none (or Attendance is not loaded or not today's). */
export function myCheckIn(attendance: Attendance | undefined): CheckIn | null {
  if (!attendance?.today) return null
  return attendance.people.find((person) => person.membershipId === attendance.me.membershipId)?.checkIn ?? null
}

/** A Check-in the screen just made, with the Attendance that was on screen at that moment. */
export type MadeCheckIn = { checkIn: CheckIn; before: Attendance | undefined }

/**
 * The Check-in the screen just made, only until Attendance is loaded again: from then on the loaded answer
 * is the truth. Without this a made Check-in that was removed afterwards would keep showing, because it is
 * later than the previous Check-in the person falls back to.
 */
export function pendingCheckIn(made: MadeCheckIn | null, attendance: Attendance | undefined): CheckIn | null {
  return made && made.before === attendance ? made.checkIn : null
}

/**
 * The caller's current Check-in while the screen holds one it just made (see {@link pendingCheckIn}): the later
 * of the loaded one and the made one, so a move shows at once and not only after Attendance reloads. A made
 * Check-in of another day than the loaded Attendance is ignored.
 */
export function currentCheckIn(attendance: Attendance | undefined, made: CheckIn | null): CheckIn | null {
  const loaded = myCheckIn(attendance)
  const kept = made && (attendance === undefined || (attendance.today && attendance.date === made.date)) ? made : null
  if (!loaded || !kept) return loaded ?? kept
  return Date.parse(kept.checkedInAt) > Date.parse(loaded.checkedInAt) ? kept : loaded
}

/** The choice "No zone" in the check-in sheet. */
export const NO_ZONE = ''

export type FloorPlanZones = { floorPlanId: string; floorPlanName: string; zones: ZoneRef[] }

/** The zones grouped by floor plan, keeping the order they came in. */
export function zonesByFloorPlan(zones: ZoneRef[]): FloorPlanZones[] {
  const groups = new Map<string, FloorPlanZones>()
  for (const zone of zones) {
    const group = groups.get(zone.floorPlanId)
    if (group) group.zones.push(zone)
    else groups.set(zone.floorPlanId, { floorPlanId: zone.floorPlanId, floorPlanName: zone.floorPlanName, zones: [zone] })
  }
  return [...groups.values()]
}

/** What the sheet starts on: the zone the person is in now, or "No zone". */
export function zoneChoice(current: CheckIn | null): string {
  return current?.zone?.id ?? NO_ZONE
}

/** True when the choice is where the person already is, so checking in would change nothing. */
export function staysPut(current: CheckIn | null, choice: string): boolean {
  return current !== null && zoneChoice(current) === choice
}

/** True when the person is in a zone that can no longer be picked (it was deleted). */
export function inGoneZone(current: CheckIn | null, zones: ZoneRef[]): boolean {
  const zone = current?.zone
  return zone != null && !zones.some((candidate) => candidate.id === zone.id)
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

import { ApiError } from '../../lib/http'
import type { Attendance, AttendancePerson, CheckIn, RollCallCrew, ZoneRef } from './attendanceApi'

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

/**
 * What the sheet starts on: where the person is now once they have checked in; before that, the zone the plan
 * expects them in, or "No zone".
 */
export function zoneChoice(current: CheckIn | null, expected: ZoneRef | null = null): string {
  if (current) return current.zone?.id ?? NO_ZONE
  return expected?.id ?? NO_ZONE
}

/** Where the plan expects the caller today; null when not expected, or when the day shown is not today. */
export function myExpectedZone(attendance: Attendance | undefined): ZoneRef | null {
  return attendance?.today ? attendance.me.expectedZone : null
}

export type AttendanceGroups = {
  /** Expected and checked in. */
  present: AttendancePerson[]
  /** Expected, with no Check-in. */
  absent: AttendancePerson[]
  /** Checked in without being expected. */
  unplanned: AttendancePerson[]
}

/** The people of the day in the three groups of the Attendance page, each in the order they came in. */
export function attendanceGroups(attendance: Attendance): AttendanceGroups {
  const groups: AttendanceGroups = { present: [], absent: [], unplanned: [] }
  for (const person of attendance.people) {
    if (person.state === 'ABSENT') groups.absent.push(person)
    else if (person.state === 'UNPLANNED') groups.unplanned.push(person)
    else groups.present.push(person)
  }
  return groups
}

/** Whether this caller may check this absent person in today. */
export function canCheckInPerson(attendance: Attendance, person: AttendancePerson): boolean {
  return attendance.today && attendance.me.canCheckInOthers === true && person.checkInAllowed === true && person.state === 'ABSENT'
}

/** The Crew rosters the backend marked eligible, only while the page shows today's Attendance. */
export function rollCallCrewsForToday(attendance: Attendance): RollCallCrew[] {
  return attendance.today ? (attendance.me.rollCallCrews ?? []) : []
}

/** The roster members to preselect; an existing Check-in means the member is already present. */
export function rollCallMemberIds(crew: RollCallCrew): string[] {
  return crew.members.filter((member) => member.checkIn === null).map((member) => member.membershipId)
}

/**
 * The zone the plan expected a present person in, only when they checked in somewhere else (another zone or
 * no zone); null when they are where they were expected, were not planned, or are absent.
 */
export function expectedElsewhere(person: AttendancePerson): ZoneRef | null {
  if (!person.checkIn || !person.expectedZone) return null
  return person.checkIn.zone?.id === person.expectedZone.id ? null : person.expectedZone
}

/**
 * The day the Attendance page asks for. `date` null asks without a date, which is today as the backend
 * defines it; `today` is the last day the backend called today, to cap the date picker.
 */
export type DayChoice = { date: string | null; today: string | null }

/**
 * The choice after the date picker changes to `value`, given the Attendance on screen. Picking today again,
 * or clearing the field, goes back to asking without a date: the dashboard never sends its own "today".
 */
export function chooseDay(choice: DayChoice, shown: Attendance | undefined, value: string): DayChoice {
  const today = shown?.today ? shown.date : choice.today
  return { date: value === '' || value === today ? null : value, today }
}

export type DayFailure = 'badDate' | 'failed'

/** Why a day could not be loaded: the backend refused the date (400: in the future or not a date), or anything else. */
export function dayFailure(error: unknown): DayFailure {
  return error instanceof ApiError && error.status === 400 ? 'badDate' : 'failed'
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
  return person.checkIn?.recordedBy.membershipId === person.membershipId
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
  return attendance.today && person.removable && person.checkIn !== null
}

export type RemovalFailure = 'locked' | 'forbidden' | 'failed'

/** Why a removal was refused: the day is over (409), the caller lacks the right (403), or anything else. */
export function removalFailure(error: unknown): RemovalFailure {
  const status = error instanceof ApiError ? error.status : undefined
  if (status === 409) return 'locked'
  if (status === 403) return 'forbidden'
  return 'failed'
}

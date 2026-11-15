import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'

/** Contract: `construx/docs/attendance.md`. `name` is the profile name, or the email without one. */
const personRefSchema = z.object({ membershipId: z.string().min(1), name: z.string() })

/** A floor plan zone with the floor plan it is drawn on. */
export const zoneRefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  floorPlanId: z.string().min(1),
  floorPlanName: z.string(),
})
export type ZoneRef = z.infer<typeof zoneRefSchema>

export const checkInSchema = z.object({
  id: z.string().min(1),
  membershipId: z.string().min(1),
  /** Where the person is; null means present with no zone. A deleted zone keeps its name here. */
  zone: zoneRefSchema.nullable().default(null),
  /** The day the Check-in counts for, in the backend's time zone (YYYY-MM-DD). */
  date: z.string().min(1),
  /** The exact moment (ISO instant). */
  checkedInAt: z.string().min(1),
  recordedBy: personRefSchema,
})
export type CheckIn = z.infer<typeof checkInSchema>

export const attendancePersonSchema = personRefSchema.extend({
  avatarUrl: z.string().nullable().default(null),
  /**
   * Against the zone plan: PRESENT is expected and checked in, ABSENT is expected with no Check-in (derived,
   * never stored), UNPLANNED is checked in without being expected.
   */
  state: z.enum(['PRESENT', 'ABSENT', 'UNPLANNED']),
  /** Whether the zone plan expected the person that day. */
  planned: z.boolean().default(false),
  /** Where the plan expected them; null when not planned. */
  expectedZone: zoneRefSchema.nullable().default(null),
  /** The person's current Check-in: the latest of the day that was not removed. Null when absent. */
  checkIn: checkInSchema.nullable(),
  /** Whether the caller may remove that Check-in now; the backend never says so on a past day. */
  removable: z.boolean().default(false),
})
export type AttendancePerson = z.infer<typeof attendancePersonSchema>

/** A Crew member and the Check-in already recorded for them today, when present. */
export const rollCallMemberSchema = personRefSchema.extend({ checkIn: checkInSchema.nullable() })
export type RollCallMember = z.infer<typeof rollCallMemberSchema>

/** A Crew the caller may record today, with its expected zone and roster. */
export const rollCallCrewSchema = z.object({
  crewId: z.string().min(1),
  name: z.string(),
  expectedZone: zoneRefSchema.nullable(),
  members: z.array(rollCallMemberSchema),
})
export type RollCallCrew = z.infer<typeof rollCallCrewSchema>

export const attendanceSchema = z.object({
  /** The day shown, chosen by the backend; the dashboard never sends its own "today". */
  date: z.string().min(1),
  today: z.boolean(),
  people: z.array(attendancePersonSchema),
  me: z.object({
    membershipId: z.string().min(1),
    /** Where the plan expects the caller that day; null when not expected. */
    expectedZone: zoneRefSchema.nullable().default(null),
    /** Whether the caller may check in another member today. */
    canCheckInOthers: z.boolean().optional(),
    /** Crews the caller may record a roll call for today. */
    rollCallCrews: z.array(rollCallCrewSchema).optional(),
  }),
})
export type Attendance = z.infer<typeof attendanceSchema>

function attendancePath(orgId: string, siteId: string): string {
  return `${sitePath(orgId, siteId)}/attendance`
}

/**
 * The Attendance of the Site on a day (YYYY-MM-DD). Without a date it is today's, as the backend defines
 * today. A date after today is refused with 400.
 */
export function getAttendance(orgId: string, siteId: string, date?: string): Promise<Attendance> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return getJson(`${attendancePath(orgId, siteId)}${query}`, attendanceSchema)
}

/** The zones of the Site a person can check in to, ordered by floor plan. */
export function getCheckInZones(orgId: string, siteId: string): Promise<ZoneRef[]> {
  return getJson(`${attendancePath(orgId, siteId)}/zones`, z.array(zoneRefSchema))
}

/**
 * Checks the caller, or an optional company member, in to the Site today, in a zone or (null) in none. A later
 * Check-in to another zone moves them; repeating the zone they are already in returns the Check-in already made.
 */
export function checkIn(
  orgId: string,
  siteId: string,
  zoneId: string | null = null,
  membershipId?: string,
): Promise<CheckIn> {
  return sendJson(
    'post',
    `${attendancePath(orgId, siteId)}/check-ins`,
    { zoneId, ...(membershipId === undefined ? {} : { membershipId }) },
    201,
    checkInSchema,
  )
}

/** Records the selected members of one eligible Crew in a single roll call today. */
export function rollCall(
  orgId: string,
  siteId: string,
  crewId: string,
  membershipIds: string[],
  zoneId: string | null,
): Promise<CheckIn[]> {
  return sendJson(
    'post',
    `${attendancePath(orgId, siteId)}/roll-calls`,
    { crewId, membershipIds, zoneId },
    201,
    z.array(checkInSchema),
  )
}

/**
 * Removes a Check-in made by mistake. Rejects with 409 when its day is over and 403 when the caller neither
 * recorded it nor manages the plan; removing one already removed succeeds.
 */
export function removeCheckIn(orgId: string, siteId: string, checkInId: string): Promise<void> {
  return deleteJson(`${attendancePath(orgId, siteId)}/check-ins/${encodeURIComponent(checkInId)}`)
}

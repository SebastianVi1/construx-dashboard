import { z } from 'zod'
import { getJson, sendJson } from '../../lib/http'
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
  state: z.enum(['PRESENT']),
  /** The person's current (latest) Check-in of the day. */
  checkIn: checkInSchema,
})
export type AttendancePerson = z.infer<typeof attendancePersonSchema>

export const attendanceSchema = z.object({
  /** The day shown, chosen by the backend; the dashboard never sends its own "today". */
  date: z.string().min(1),
  today: z.boolean(),
  people: z.array(attendancePersonSchema),
  me: z.object({ membershipId: z.string().min(1) }),
})
export type Attendance = z.infer<typeof attendanceSchema>

function attendancePath(orgId: string, siteId: string): string {
  return `${sitePath(orgId, siteId)}/attendance`
}

/** Today's Attendance of the Site, as the backend defines today. */
export function getAttendance(orgId: string, siteId: string): Promise<Attendance> {
  return getJson(attendancePath(orgId, siteId), attendanceSchema)
}

/** The zones of the Site a person can check in to, ordered by floor plan. */
export function getCheckInZones(orgId: string, siteId: string): Promise<ZoneRef[]> {
  return getJson(`${attendancePath(orgId, siteId)}/zones`, z.array(zoneRefSchema))
}

/**
 * Checks the caller in to the Site today, in a zone or (null) in none. A later Check-in to another zone moves
 * them; repeating the zone they are already in returns the Check-in already made.
 */
export function checkIn(orgId: string, siteId: string, zoneId: string | null = null): Promise<CheckIn> {
  return sendJson('post', `${attendancePath(orgId, siteId)}/check-ins`, { zoneId }, 201, checkInSchema)
}

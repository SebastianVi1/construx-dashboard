import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'

/** Contract: `construx/docs/attendance.md`. `name` is the profile name, or the email without one. */
const personRefSchema = z.object({ membershipId: z.string().min(1), name: z.string() })

export const checkInSchema = z.object({
  id: z.string().min(1),
  membershipId: z.string().min(1),
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
  /** Whether the caller may remove that Check-in now; the backend never says so on a past day. */
  removable: z.boolean().default(false),
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

/** Checks the caller in to the Site today; repeating it returns the Check-in already made. */
export function checkIn(orgId: string, siteId: string): Promise<CheckIn> {
  return sendJson('post', `${attendancePath(orgId, siteId)}/check-ins`, {}, 201, checkInSchema)
}

/**
 * Removes a Check-in made by mistake. Rejects with 409 when its day is over and 403 when the caller neither
 * recorded it nor manages the plan; removing one already removed succeeds.
 */
export function removeCheckIn(orgId: string, siteId: string, checkInId: string): Promise<void> {
  return deleteJson(`${attendancePath(orgId, siteId)}/check-ins/${encodeURIComponent(checkInId)}`)
}

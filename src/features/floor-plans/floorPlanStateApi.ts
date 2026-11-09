import { z } from 'zod'
import { getJson } from '../../lib/http'
import { floorPlanPath } from '../../lib/apiPaths'
import { zoneSchema } from './zonesApi'
import { assignmentDataSchema } from './zoneAssignmentsApi'

export const zoneStateSchema = z.object({
  zone: zoneSchema,
  activeAssignments: z.array(assignmentDataSchema),
})
export type ZoneState = z.infer<typeof zoneStateSchema>

/** A day as the backend's `date` parameter wants it: YYYY-MM-DD in the viewer's own time zone. */
export function localIsoDate(day: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/**
 * The single read of a plan: every zone with the assignments active on `date`, each with its
 * occupant already named (people with photo and open tasks, crews with members, equipment).
 */
export function getFloorPlanState(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  date: string,
): Promise<ZoneState[]> {
  const path = `${floorPlanPath(orgId, siteId, floorPlanId)}/state?date=${encodeURIComponent(date)}`
  return getJson(path, z.array(zoneStateSchema))
}

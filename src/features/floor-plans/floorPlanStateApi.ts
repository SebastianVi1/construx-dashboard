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

export function getFloorPlanState(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  date: string,
): Promise<ZoneState[]> {
  const path = `${floorPlanPath(orgId, siteId, floorPlanId)}/state?date=${encodeURIComponent(date)}`
  return getJson(path, z.array(zoneStateSchema))
}

import { z } from 'zod'
import { getJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'
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
  const path = `${organizationPath(orgId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/state?date=${encodeURIComponent(date)}`
  return getJson(path, z.array(zoneStateSchema))
}

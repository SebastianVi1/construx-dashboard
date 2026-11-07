import { z } from 'zod'
import { getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

export const calibrationSchema = z.object({
  id: z.string().min(1),
  floorPlanId: z.string().min(1),
  metersPerPx: z.number(),
  pointAX: z.number(),
  pointAY: z.number(),
  pointBX: z.number(),
  pointBY: z.number(),
  lengthMeters: z.number(),
  createdAt: z.string(),
})

export type Calibration = z.infer<typeof calibrationSchema>

export type SaveCalibrationRequest = {
  pointAX: number
  pointAY: number
  pointBX: number
  pointBY: number
  lengthMeters: number
}

function calibrationPath(organizationId: string, siteId: string, floorPlanId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/calibration`
}

export function saveCalibration(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  request: SaveCalibrationRequest,
): Promise<Calibration> {
  return sendJson('put', calibrationPath(organizationId, siteId, floorPlanId), request, 200, calibrationSchema)
}

export function getCalibration(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
): Promise<Calibration> {
  return getJson(calibrationPath(organizationId, siteId, floorPlanId), calibrationSchema)
}

/** Pure helper: compute metersPerPx from two pixel points and a real-world distance. */
export function computeMetersPerPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  lengthMeters: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  return lengthMeters / Math.sqrt(dx * dx + dy * dy)
}

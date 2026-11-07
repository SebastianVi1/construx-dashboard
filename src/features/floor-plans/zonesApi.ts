import { z } from 'zod'
import { getJson, sendJson, deleteJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

export const zoneStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'DONE'])
export type ZoneStatus = z.infer<typeof zoneStatusSchema>

export const zoneSchema = z.object({
  id: z.string().min(1),
  floorPlanId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  status: zoneStatusSchema,
  points: z.array(z.tuple([z.number(), z.number()])),
  areaMSquared: z.number(),
  perimeterMeters: z.number(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Zone = z.infer<typeof zoneSchema>

export const ZONE_STATUS_COLORS: Record<ZoneStatus, string> = {
  NOT_STARTED: '#9CA3AF',
  IN_PROGRESS: '#3B82F6',
  ON_HOLD: '#EAB308',
  DONE: '#22C55E',
}

function zonesPath(organizationId: string, siteId: string, floorPlanId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/zones`
}

export type CreateZoneRequest = {
  name: string
  description: string | null
  status: ZoneStatus
  points: [number, number][]
}

export type UpdateZoneRequest = {
  name: string
  description: string | null
  status: ZoneStatus
  points: [number, number][]
  version: number
}

export function listZones(organizationId: string, siteId: string, floorPlanId: string): Promise<Zone[]> {
  return getJson(zonesPath(organizationId, siteId, floorPlanId), z.array(zoneSchema))
}

export function createZone(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  request: CreateZoneRequest,
): Promise<Zone> {
  return sendJson('post', zonesPath(organizationId, siteId, floorPlanId), request, 201, zoneSchema)
}

export function updateZone(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
  request: UpdateZoneRequest,
): Promise<Zone> {
  return sendJson(
    'patch',
    `${zonesPath(organizationId, siteId, floorPlanId)}/${encodeURIComponent(zoneId)}`,
    request,
    200,
    zoneSchema,
  )
}

export function deleteZone(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
): Promise<void> {
  return deleteJson(
    `${zonesPath(organizationId, siteId, floorPlanId)}/${encodeURIComponent(zoneId)}`,
  )
}

/** Pure helper: compute polygon area using the Shoelace formula. Points are [x, y] pairs in metres. */
export function computeZoneArea(points: [number, number][]): number {
  const n = points.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i]!
    const [x2, y2] = points[(i + 1) % n]!
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

/** Pure helper: compute polygon perimeter. Points are [x, y] pairs in metres. */
export function computeZonePerimeter(points: [number, number][]): number {
  const n = points.length
  if (n < 2) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i]!
    const [x2, y2] = points[(i + 1) % n]!
    const dx = x2 - x1
    const dy = y2 - y1
    sum += Math.sqrt(dx * dx + dy * dy)
  }
  return sum
}

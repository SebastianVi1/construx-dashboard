import { z } from 'zod'
import { getJson } from '../../lib/http'
import { floorPlanPath } from '../../lib/apiPaths'

export const auditEventSchema = z.object({
  id: z.string().min(1),
  entityType: z.string(),
  entityId: z.string().min(1),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'CLOSE', 'MOVE']),
  actorMembershipId: z.string().nullable(),
  beforeState: z.string().nullable(),
  afterState: z.string().nullable(),
  occurredAt: z.string(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>

function zonePath(orgId: string, siteId: string, floorPlanId: string, zoneId: string): string {
  return `${floorPlanPath(orgId, siteId, floorPlanId)}/zones/${encodeURIComponent(zoneId)}`
}

export function getZoneAudit(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
): Promise<AuditEvent[]> {
  return getJson(`${zonePath(orgId, siteId, floorPlanId, zoneId)}/audit`, z.array(auditEventSchema))
}

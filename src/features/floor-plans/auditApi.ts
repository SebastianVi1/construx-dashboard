import { z } from 'zod'
import { getJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

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
  return `${organizationPath(orgId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/zones/${encodeURIComponent(zoneId)}`
}

export function getZoneAudit(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
): Promise<AuditEvent[]> {
  return getJson(`${zonePath(orgId, siteId, floorPlanId, zoneId)}/audit`, z.array(auditEventSchema))
}

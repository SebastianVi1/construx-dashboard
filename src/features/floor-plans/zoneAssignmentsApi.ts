import { z } from 'zod'
import { getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

export const shiftSchema = z.enum(['MORNING', 'AFTERNOON', 'FULL_DAY'])
export type Shift = z.infer<typeof shiftSchema>

export const assignmentDataSchema = z.object({
  id: z.string().min(1),
  zoneId: z.string().min(1),
  membershipId: z.string().nullable(),
  crewId: z.string().nullable(),
  equipmentId: z.string().nullable(),
  activity: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  shift: shiftSchema,
  createdAt: z.string(),
  closedAt: z.string().nullable(),
})
export type AssignmentData = z.infer<typeof assignmentDataSchema>

export const createAssignmentResponseSchema = z.object({
  assignment: assignmentDataSchema,
  hasOverlapWarning: z.boolean(),
})
export type CreateAssignmentResponse = z.infer<typeof createAssignmentResponseSchema>

export type ResourceType = 'membership' | 'crew' | 'equipment'

export type DraggableResource = {
  type: ResourceType
  id: string
  name: string
}

/** Payload set on a drag that moves an existing assignment to a different zone. */
export type ReassignDrag = {
  assignmentId: string
  sourceZoneId: string
  label: string
}

export type CreateAssignmentRequest = {
  membershipId?: string | null
  crewId?: string | null
  equipmentId?: string | null
  activity: string
  startDate: string
  endDate?: string | null
  shift: Shift
}

function assignmentsPath(orgId: string, siteId: string, floorPlanId: string, zoneId: string): string {
  return `${organizationPath(orgId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/zones/${encodeURIComponent(zoneId)}/assignments`
}

export function listAssignments(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
): Promise<AssignmentData[]> {
  return getJson(assignmentsPath(orgId, siteId, floorPlanId, zoneId), z.array(assignmentDataSchema))
}

export function createAssignment(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
  request: CreateAssignmentRequest,
): Promise<CreateAssignmentResponse> {
  return sendJson(
    'post',
    assignmentsPath(orgId, siteId, floorPlanId, zoneId),
    request,
    201,
    createAssignmentResponseSchema,
  )
}

export function closeAssignment(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
  assignmentId: string,
): Promise<AssignmentData> {
  return sendJson(
    'post',
    `${assignmentsPath(orgId, siteId, floorPlanId, zoneId)}/${encodeURIComponent(assignmentId)}/close`,
    {},
    200,
    assignmentDataSchema,
  )
}

export function reassignToZone(
  orgId: string,
  siteId: string,
  floorPlanId: string,
  zoneId: string,
  assignmentId: string,
  newZoneId: string,
): Promise<AssignmentData> {
  return sendJson(
    'post',
    `${assignmentsPath(orgId, siteId, floorPlanId, zoneId)}/${encodeURIComponent(assignmentId)}/reassign`,
    { newZoneId },
    200,
    assignmentDataSchema,
  )
}

export function getZoneAssignmentCounts(
  orgId: string,
  siteId: string,
  floorPlanId: string,
): Promise<Record<string, number>> {
  return getJson(
    `${organizationPath(orgId)}/projects/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}/zones/assignment-counts`,
    z.record(z.string(), z.number()),
  )
}

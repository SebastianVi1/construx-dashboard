import { z } from 'zod'
import { getJson, sendJson } from '../../lib/http'
import { floorPlanPath } from '../../lib/apiPaths'
import { personSchema } from '../people/personSchema'
import { taskRoles, taskStatuses } from '../tasks/tasksApi'

export const shiftSchema = z.enum(['MORNING', 'AFTERNOON', 'FULL_DAY'])
export type Shift = z.infer<typeof shiftSchema>

/** An unfinished task of the Site in a person's team, as the plan shows it. */
export const openTaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  goalId: z.string().min(1),
  name: z.string(),
  goalName: z.string(),
  status: z.enum(taskStatuses),
  taskRole: z.enum(taskRoles),
  dueAt: z.string(),
})
export type OpenTask = z.infer<typeof openTaskSchema>

/**
 * A person on the plan, named by the backend. `openTasks` is empty when the viewer may not see that
 * person's tasks.
 */
export const workerSchema = personSchema.extend({
  membershipId: z.string().min(1),
  roleName: z.string().nullable(),
  crewLeader: z.boolean(),
  openTasks: z.array(openTaskSchema),
})
export type Worker = z.infer<typeof workerSchema>

/**
 * Who or what an assignment puts in a zone (`Occupant` in the backend). `id` is the membership,
 * crew or equipment id; `members` are the people it stands for (one, the crew, or none).
 */
export const assignmentOccupantSchema = personSchema.pick({ avatarUrl: true }).extend({
  kind: z.enum(['PERSON', 'CREW', 'EQUIPMENT']),
  id: z.string().min(1),
  /** Person name (null without a profile), crew name, or "type — identifier". */
  label: z.string().nullable(),
  members: z.array(workerSchema),
  equipment: z.object({ type: z.string(), identifier: z.string() }).nullable(),
})
export type AssignmentOccupant = z.infer<typeof assignmentOccupantSchema>

export const assignmentDataSchema = z.object({
  id: z.string().min(1),
  zoneId: z.string().min(1),
  membershipId: z.string().nullable(),
  crewId: z.string().nullable(),
  equipmentId: z.string().nullable(),
  activity: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  shift: shiftSchema,
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  occupant: assignmentOccupantSchema.nullable(),
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

/** Only the resource is required; the server starts the assignment today for the full day. */
export type CreateAssignmentRequest = {
  membershipId?: string | null
  crewId?: string | null
  equipmentId?: string | null
  activity?: string | null
  startDate?: string
  endDate?: string | null
  shift?: Shift
}

function assignmentsPath(orgId: string, siteId: string, floorPlanId: string, zoneId: string): string {
  return `${floorPlanPath(orgId, siteId, floorPlanId)}/zones/${encodeURIComponent(zoneId)}/assignments`
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
    `${floorPlanPath(orgId, siteId, floorPlanId)}/zones/assignment-counts`,
    z.record(z.string(), z.number()),
  )
}

/** Active assignments across every zone of a floor plan. */
export function listFloorPlanAssignments(
  orgId: string,
  siteId: string,
  floorPlanId: string,
): Promise<AssignmentData[]> {
  return getJson(
    `${floorPlanPath(orgId, siteId, floorPlanId)}/assignments`,
    z.array(assignmentDataSchema),
  )
}

import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

// ── Crew ──────────────────────────────────────────────────────────────────────

export const crewSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string(),
  leaderMembershipId: z.string().min(1),
  memberMembershipIds: z.array(z.string()),
  createdAt: z.string(),
})

export type Crew = z.infer<typeof crewSchema>

export type CreateCrewRequest = {
  name: string
  leaderMembershipId: string
}

export function listCrews(organizationId: string): Promise<Crew[]> {
  return getJson(`${organizationPath(organizationId)}/crews`, z.array(crewSchema))
}

export function createCrew(organizationId: string, request: CreateCrewRequest): Promise<Crew> {
  return sendJson('post', `${organizationPath(organizationId)}/crews`, request, 201, crewSchema)
}

export function addCrewMember(organizationId: string, crewId: string, membershipId: string): Promise<Crew> {
  return sendJson('post', `${organizationPath(organizationId)}/crews/${crewId}/members`, { membershipId }, 200, crewSchema)
}

export function removeCrewMember(
  organizationId: string,
  crewId: string,
  membershipId: string,
): Promise<void> {
  return deleteJson(`${organizationPath(organizationId)}/crews/${crewId}/members/${membershipId}`)
}

export function deleteCrew(organizationId: string, crewId: string): Promise<void> {
  return deleteJson(`${organizationPath(organizationId)}/crews/${crewId}`)
}

// ── Equipment ─────────────────────────────────────────────────────────────────

export const equipmentSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  type: z.string().min(1),
  identifier: z.string().min(1),
  dailyCostCents: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
})

export type Equipment = z.infer<typeof equipmentSchema>

export type CreateEquipmentRequest = {
  type: string
  identifier: string
  dailyCostCents?: number | null
}

export type UpdateEquipmentRequest = {
  type?: string
  identifier?: string
  dailyCostCents?: number | null
  active?: boolean
}

export function listEquipment(organizationId: string, activeOnly?: boolean): Promise<Equipment[]> {
  const query = activeOnly ? '?activeOnly=true' : ''
  return getJson(
    `${organizationPath(organizationId)}/equipment${query}`,
    z.array(equipmentSchema),
  )
}

export function createEquipment(
  organizationId: string,
  request: CreateEquipmentRequest,
): Promise<Equipment> {
  return sendJson('post', `${organizationPath(organizationId)}/equipment`, request, 201, equipmentSchema)
}

export function updateEquipment(
  organizationId: string,
  equipmentId: string,
  request: UpdateEquipmentRequest,
): Promise<Equipment> {
  return sendJson(
    'patch',
    `${organizationPath(organizationId)}/equipment/${equipmentId}`,
    request,
    200,
    equipmentSchema,
  )
}

export function deleteEquipment(organizationId: string, equipmentId: string): Promise<void> {
  return deleteJson(`${organizationPath(organizationId)}/equipment/${equipmentId}`)
}

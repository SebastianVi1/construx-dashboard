import { z } from 'zod'
import { getJson, sendJson, deleteJson } from '../../lib/http'
import { floorPlanPath } from '../../lib/apiPaths'

export const pinKindSchema = z.enum(['ISSUE', 'PHOTO'])
export type PinKind = z.infer<typeof pinKindSchema>

export const pinStatusSchema = z.enum(['OPEN', 'RESOLVED', 'CLOSED'])
export type PinStatus = z.infer<typeof pinStatusSchema>

export const photoPhaseSchema = z.enum(['REPORT', 'RESOLUTION'])
export type PhotoPhase = z.infer<typeof photoPhaseSchema>

const personRefSchema = z.object({ membershipId: z.string().min(1), fullName: z.string().nullable() })

export const pinPhotoSchema = z.object({
  id: z.string().min(1),
  phase: photoPhaseSchema,
  url: z.string().min(1),
  createdAt: z.string(),
})
export type PinPhoto = z.infer<typeof pinPhotoSchema>

/**
 * A spot on the plan: an ISSUE tracked until closed, or a progress PHOTO (no status, no assignee).
 * `x`/`y` are plan image pixels, like zone points. `can` is what the caller may do, as the API enforces it.
 */
export const pinSchema = z.object({
  id: z.string().min(1),
  floorPlanId: z.string().min(1),
  kind: pinKindSchema,
  x: z.number(),
  y: z.number(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  status: pinStatusSchema.nullable(),
  assignee: personRefSchema.nullable(),
  createdBy: personRefSchema,
  zoneId: z.string().nullable(),
  zoneName: z.string().nullable(),
  photoCount: z.number().int(),
  coverUrl: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  can: z.object({
    edit: z.boolean(),
    assign: z.boolean(),
    resolve: z.boolean(),
    close: z.boolean(),
    reopen: z.boolean(),
    delete: z.boolean(),
  }),
})
export type Pin = z.infer<typeof pinSchema>

/** A pin read on its own also carries its photos, as links that expire after an hour. */
export const pinDetailSchema = pinSchema.extend({ photos: z.array(pinPhotoSchema) })
export type PinDetail = z.infer<typeof pinDetailSchema>

export const pinAuditEventSchema = z.object({
  id: z.string().min(1),
  action: z.string(),
  actorMembershipId: z.string().nullable(),
  occurredAt: z.string(),
})
export type PinAuditEvent = z.infer<typeof pinAuditEventSchema>

export const pinUploadTicketSchema = z.object({
  key: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})
export type PinUploadTicket = z.infer<typeof pinUploadTicketSchema>

export type PinFilters = { kind?: PinKind; status?: PinStatus; assignee?: 'me'; zoneId?: string }

export type CreatePinRequest = {
  kind: PinKind
  x: number
  y: number
  title: string | null
  description: string | null
  assigneeMembershipId: string | null
  photoKeys: string[]
}

export type UpdatePinRequest = {
  title: string | null
  description: string | null
  x: number
  y: number
  assigneeMembershipId: string | null
  version: number
}

function pinsPath(organizationId: string, siteId: string, floorPlanId: string): string {
  return `${floorPlanPath(organizationId, siteId, floorPlanId)}/pins`
}

function pinPath(organizationId: string, siteId: string, floorPlanId: string, pinId: string): string {
  return `${pinsPath(organizationId, siteId, floorPlanId)}/${encodeURIComponent(pinId)}`
}

export function listPins(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  filters: PinFilters = {},
): Promise<Pin[]> {
  const query = new URLSearchParams()
  if (filters.kind) query.set('kind', filters.kind)
  if (filters.status) query.set('status', filters.status)
  if (filters.assignee) query.set('assignee', filters.assignee)
  if (filters.zoneId) query.set('zoneId', filters.zoneId)
  const suffix = query.size > 0 ? `?${query}` : ''
  return getJson(`${pinsPath(organizationId, siteId, floorPlanId)}${suffix}`, z.array(pinSchema))
}

export function getPin(organizationId: string, siteId: string, floorPlanId: string, pinId: string): Promise<PinDetail> {
  return getJson(pinPath(organizationId, siteId, floorPlanId, pinId), pinDetailSchema)
}

export function createPin(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  request: CreatePinRequest,
): Promise<PinDetail> {
  return sendJson('post', pinsPath(organizationId, siteId, floorPlanId), request, 201, pinDetailSchema)
}

export function updatePin(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  pinId: string,
  request: UpdatePinRequest,
): Promise<PinDetail> {
  return sendJson('patch', pinPath(organizationId, siteId, floorPlanId, pinId), request, 200, pinDetailSchema)
}

export function deletePin(organizationId: string, siteId: string, floorPlanId: string, pinId: string): Promise<void> {
  return deleteJson(pinPath(organizationId, siteId, floorPlanId, pinId))
}

/** Photos sent with RESOLVED or CLOSED are stored as resolution photos. */
export function setPinStatus(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  pinId: string,
  status: PinStatus,
  photoKeys: string[] = [],
): Promise<PinDetail> {
  return sendJson(
    'post',
    `${pinPath(organizationId, siteId, floorPlanId, pinId)}/status`,
    { status, photoKeys },
    200,
    pinDetailSchema,
  )
}

export function addPinPhotos(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  pinId: string,
  keys: string[],
  phase: PhotoPhase,
): Promise<PinDetail> {
  return sendJson(
    'post',
    `${pinPath(organizationId, siteId, floorPlanId, pinId)}/photos`,
    { keys, phase },
    200,
    pinDetailSchema,
  )
}

export function deletePinPhoto(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  pinId: string,
  photoId: string,
): Promise<void> {
  return deleteJson(`${pinPath(organizationId, siteId, floorPlanId, pinId)}/photos/${encodeURIComponent(photoId)}`)
}

export function getPinAudit(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  pinId: string,
): Promise<PinAuditEvent[]> {
  return getJson(`${pinPath(organizationId, siteId, floorPlanId, pinId)}/audit`, z.array(pinAuditEventSchema))
}

/** Step 1 of a photo upload: a presigned PUT for a file of this type and size. */
export function requestPinPhotoUpload(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  contentType: string,
  sizeBytes: number,
): Promise<PinUploadTicket> {
  return sendJson(
    'post',
    `${pinsPath(organizationId, siteId, floorPlanId)}/photo-uploads`,
    { contentType, sizeBytes },
    201,
    pinUploadTicketSchema,
  )
}

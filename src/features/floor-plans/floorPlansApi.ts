import { z } from 'zod'
import { ApiError, deleteJson, getJson, sendJson } from '../../lib/http'
import { sitePath, floorPlanPath } from '../../lib/apiPaths'
import type { StorageRequest } from '../plans/plansApi'

export const floorPlanStatusSchema = z.enum(['PENDING', 'PROCESSING', 'READY', 'ERROR'])
export type FloorPlanStatus = z.infer<typeof floorPlanStatusSchema>

export const floorPlanSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  level: z.string().nullable(),
  pageNumber: z.number().int(),
  status: floorPlanStatusSchema,
  errorReason: z.string().nullable(),
  viewUrl: z.string().nullable(),
  viewUrlExpiresAt: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
})

export type FloorPlan = z.infer<typeof floorPlanSchema>

export const floorPlanUploadTicketSchema = z.object({
  floorPlanId: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export type FloorPlanUploadTicket = z.infer<typeof floorPlanUploadTicketSchema>

export type FloorPlanUploadRequest = {
  name: string
  description?: string
  level?: string
  pageNumber: number
  contentType: string
  sizeBytes: number
}

function floorPlansPath(organizationId: string, siteId: string): string {
  return `${sitePath(organizationId, siteId)}/floor-plans`
}

/** Step 1: announce the file and get a presigned upload URL. */
export function requestFloorPlanUpload(
  organizationId: string,
  siteId: string,
  request: FloorPlanUploadRequest,
): Promise<FloorPlanUploadTicket> {
  const body: Record<string, string | number> = {
    name: request.name,
    pageNumber: request.pageNumber,
    contentType: request.contentType,
    sizeBytes: request.sizeBytes,
  }
  if (request.description?.trim()) body.description = request.description.trim()
  if (request.level?.trim()) body.level = request.level.trim()
  return sendJson('post', `${floorPlansPath(organizationId, siteId)}/uploads`, body, 201, floorPlanUploadTicketSchema)
}

/** Step 3: confirm upload and start async processing. Returns PROCESSING status immediately. */
export function completeFloorPlanUpload(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
): Promise<FloorPlan> {
  return sendJson(
    'post',
    `${floorPlanPath(organizationId, siteId, floorPlanId)}/complete`,
    undefined,
    200,
    floorPlanSchema,
  )
}

/** List all floor plans for a site, newest first. */
export function listFloorPlans(organizationId: string, siteId: string): Promise<FloorPlan[]> {
  return getJson(floorPlansPath(organizationId, siteId), z.array(floorPlanSchema))
}

/** Get a single floor plan with a fresh presigned view URL (1-hour TTL). */
export function getFloorPlan(organizationId: string, siteId: string, floorPlanId: string): Promise<FloorPlan> {
  return getJson(floorPlanPath(organizationId, siteId, floorPlanId), floorPlanSchema)
}

/** Delete a floor plan (removes row + S3 files). */
export function deleteFloorPlan(organizationId: string, siteId: string, floorPlanId: string): Promise<void> {
  return deleteJson(floorPlanPath(organizationId, siteId, floorPlanId))
}

/** Step 2: PUT the file straight to storage (no session cookies, no CSRF). Reports progress 0–1. */
export class StorageUploadError extends Error {
  readonly status: number

  constructor(status: number) {
    super('Floor plan upload to storage failed')
    this.name = 'StorageUploadError'
    this.status = status
  }
}

export function sendFloorPlanToStorage(
  ticket: Pick<FloorPlanUploadTicket, 'uploadUrl' | 'headers'>,
  body: Blob,
  onProgress: (fraction: number) => void,
  createRequest: () => StorageRequest = () => new XMLHttpRequest(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = createRequest()
    request.open('PUT', ticket.uploadUrl)
    request.withCredentials = false
    for (const [name, value] of Object.entries(ticket.headers)) request.setRequestHeader(name, value)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new StorageUploadError(request.status))
      }
    }
    request.onerror = () => reject(new StorageUploadError(0))
    request.send(body)
  })
}

export type FloorPlanErrorKind =
  | 'fileType'
  | 'tooLarge'
  | 'uploadFailed'
  | 'invalid'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

export function floorPlanErrorKind(error: unknown): FloorPlanErrorKind {
  if (error instanceof StorageUploadError) return 'uploadFailed'
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'FLOOR_PLAN_FILE_TYPE') return 'fileType'
  if (error.code === 'FLOOR_PLAN_FILE_TOO_LARGE') return 'tooLarge'
  if (error.code === 'FLOOR_PLAN_UPLOAD_MISSING') return 'uploadFailed'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

/** Returns true if the view URL expires within the given number of minutes. */
export function viewUrlExpiresSoon(floorPlan: FloorPlan, withinMinutes = 5): boolean {
  if (!floorPlan.viewUrlExpiresAt) return false
  const expiresAt = new Date(floorPlan.viewUrlExpiresAt).getTime()
  return expiresAt - Date.now() < withinMinutes * 60 * 1000
}

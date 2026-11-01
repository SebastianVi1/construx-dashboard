import { z } from 'zod'
import { AuthApiError, deleteJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

/** `PlanResponse`. `viewUrl` is a short-lived link to the image; reload the list for a fresh one. */
export const planSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  viewUrl: z.string().nullable(),
  viewUrlExpiresAt: z.string().nullable(),
})

export type Plan = z.infer<typeof planSchema>

/** Where to send the file: one PUT to `uploadUrl` with exactly `headers`. */
export const uploadTicketSchema = z.object({
  planId: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export type UploadTicket = z.infer<typeof uploadTicketSchema>

export type PlanUploadRequest = {
  fileName: string
  contentType: string
  sizeBytes: number
  name: string
  description: string
}

function plansPath(organizationId: string, siteId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}/plans`
}

function planPath(organizationId: string, siteId: string, planId: string): string {
  return `${plansPath(organizationId, siteId)}/${encodeURIComponent(planId)}`
}

/** Ready plans of the site, newest first. */
/** Step 1: announce the file; blank name and description are left out. */
export function requestPlanUpload(organizationId: string, siteId: string, request: PlanUploadRequest): Promise<UploadTicket> {
  const body: Record<string, string | number> = {
    fileName: request.fileName,
    contentType: request.contentType,
    sizeBytes: request.sizeBytes,
  }
  const name = request.name.trim()
  if (name) body.name = name
  const description = request.description.trim()
  if (description) body.description = description
  return sendJson('post', `${plansPath(organizationId, siteId)}/uploads`, body, 201, uploadTicketSchema)
}

/** Step 3: the server checks the file in storage and makes the plan visible. */
export function completePlanUpload(organizationId: string, siteId: string, planId: string): Promise<Plan> {
  return sendJson('post', `${planPath(organizationId, siteId, planId)}/complete`, undefined, 200, planSchema)
}

export function deletePlan(organizationId: string, siteId: string, planId: string): Promise<void> {
  return deleteJson(planPath(organizationId, siteId, planId))
}

/** Storage answered with an error status, or the request never reached it (status 0). */
export class StorageUploadError extends Error {
  readonly status: number

  constructor(status: number) {
    super('Plan upload to storage failed')
    this.name = 'StorageUploadError'
    this.status = status
  }
}

/** The part of `XMLHttpRequest` the upload uses, so tests can fake it. */
export type StorageRequest = Pick<
  XMLHttpRequest,
  'status' | 'withCredentials' | 'upload' | 'onload' | 'onerror' | 'open' | 'setRequestHeader' | 'send'
>

/**
 * Step 2: PUT the file straight to storage. Not through the API client: storage must not receive the
 * session cookies or CSRF header, and XHR reports real upload progress (0 to 1).
 */
export function sendToStorage(
  ticket: Pick<UploadTicket, 'uploadUrl' | 'headers'>,
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

export type PlanErrorKind =
  | 'fileType'
  | 'tooLarge'
  | 'uploadFailed'
  | 'invalid'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

/** Message to show when loading, uploading or deleting a plan fails. */
export function planErrorKind(error: unknown): PlanErrorKind {
  if (error instanceof StorageUploadError) return 'uploadFailed'
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.code === 'PLAN_FILE_TYPE') return 'fileType'
  if (error.code === 'PLAN_FILE_TOO_LARGE') return 'tooLarge'
  if (error.code === 'PLAN_UPLOAD_MISSING' || error.code === 'PLAN_UPLOAD_MISMATCH') return 'uploadFailed'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { roleSchema } from '../permissions/can'
import { organizationPath } from '../permissions/permissionsApi'

export const siteStatuses = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const

export type SiteStatus = (typeof siteStatuses)[number]

/** `ProjectResponse`. Progress counts are null when the caller cannot see the site's tasks. */
export const siteSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  address: z.string().nullable(),
  startDate: z.string().nullable(),
  expectedEndDate: z.string().nullable(),
  status: z.enum(siteStatuses),
  activityCount: z.number().int().nullable(),
  doneCount: z.number().int().nullable(),
})

export type Site = z.infer<typeof siteSchema>

/** `AccessResponse`: a person on a site. No email, because workers can read it. */
export const siteAccessSchema = z.object({
  accessId: z.string().min(1),
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  fullName: z.string().nullable(),
  role: roleSchema,
})

export type SiteAccess = z.infer<typeof siteAccessSchema>

/** Values as typed in the create form; empty strings mean "not given". */
export type SiteDraft = {
  name: string
  address: string
  startDate: string
  expectedEndDate: string
  status: string
}

export type SitePatch = Partial<{
  name: string
  address: string
  startDate: string
  expectedEndDate: string
  status: SiteStatus
}>

function sitesPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/projects`
}

function sitePath(organizationId: string, siteId: string): string {
  return `${sitesPath(organizationId)}/${encodeURIComponent(siteId)}`
}

/** Sites visible to the caller. Without `status` the server hides archived ones. */
export function listSites(organizationId: string, status?: SiteStatus): Promise<Site[]> {
  const query = status ? `?status=${status}` : ''
  return getJson(`${sitesPath(organizationId)}${query}`, z.array(siteSchema))
}

export function getSite(organizationId: string, siteId: string): Promise<Site> {
  return getJson(sitePath(organizationId, siteId), siteSchema)
}

/** Create a site; only the name is required, blank optional fields are left out. */
export function createSite(organizationId: string, draft: SiteDraft): Promise<Site> {
  const body: Record<string, string> = { name: draft.name.trim() }
  const address = draft.address.trim()
  if (address) body.address = address
  if (draft.startDate) body.startDate = draft.startDate
  if (draft.expectedEndDate) body.expectedEndDate = draft.expectedEndDate
  if (draft.status) body.status = draft.status
  return sendJson('post', sitesPath(organizationId), body, 201, siteSchema)
}

/** Change only the fields sent. Archive a site by sending `status: 'ARCHIVED'`. */
export function updateSite(organizationId: string, siteId: string, patch: SitePatch): Promise<Site> {
  return sendJson('patch', sitePath(organizationId, siteId), patch, 200, siteSchema)
}

export function listSiteAccess(organizationId: string, siteId: string): Promise<SiteAccess[]> {
  return getJson(`${sitePath(organizationId, siteId)}/access`, z.array(siteAccessSchema))
}

export function assignToSite(organizationId: string, siteId: string, membershipId: string): Promise<SiteAccess> {
  return sendJson('post', `${sitePath(organizationId, siteId)}/access`, { membershipId }, 201, siteAccessSchema)
}

export function removeFromSite(organizationId: string, siteId: string, accessId: string): Promise<void> {
  return deleteJson(`${sitePath(organizationId, siteId)}/access/${encodeURIComponent(accessId)}`)
}

export type SiteErrorKind = 'dateOrder' | 'invalid' | 'session' | 'forbidden' | 'notFound' | 'generic'

/** Message to show when loading, creating or editing a site fails. */
export function siteErrorKind(error: unknown): SiteErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return error.code === 'INVALID_ARGUMENT' ? 'dateOrder' : 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

export type AccessErrorKind =
  | 'hasTasks'
  | 'alreadyAssigned'
  | 'inactive'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

/** Message to show when assigning or removing a person on a site fails. */
export function accessErrorKind(error: unknown): AccessErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 409) return error.code === 'DATA_CONFLICT' ? 'alreadyAssigned' : 'hasTasks'
  if (error.status === 400) return 'inactive'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

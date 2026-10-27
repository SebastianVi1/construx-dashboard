import { getJson } from '../auth/authApi'
import { myAccessSchema, type MyAccess } from './can'

/** Base path of every endpoint under one organization. */
export function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`
}

/** The caller's membership, role and permissions in an organization. */
export function getMyAccess(organizationId: string): Promise<MyAccess> {
  return getJson(`${organizationPath(organizationId)}/me`, myAccessSchema)
}

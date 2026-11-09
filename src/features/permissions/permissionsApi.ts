import { getJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'
import { myAccessSchema, type MyAccess } from './can'

/** The caller's membership, role and permissions in an organization. */
export function getMyAccess(organizationId: string): Promise<MyAccess> {
  return getJson(`${organizationPath(organizationId)}/me`, myAccessSchema)
}

import { z } from 'zod'
import { getJson, sendJson } from '../auth/authApi'

/**
 * `OrganizationResponse` from the v1 contract. `myRole` is in the contract but
 * not yet sent by the backend, so it is optional and normalized to `null`.
 */
export const organizationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.string(),
  myRole: z
    .object({ code: z.string(), name: z.string() })
    .nullable()
    .optional()
    .transform((role) => role ?? null),
})

export type Organization = z.infer<typeof organizationSchema>

const organizationListSchema = z.array(organizationSchema)

/** Found a company; the caller becomes its OWNER. Resolves with the new organization (201). */
export function createOrganization(name: string): Promise<Organization> {
  return sendJson('post', '/organizations', { name: name.trim() }, 201, organizationSchema)
}

/** Organizations where the caller has an active membership; empty array when none. */
export function listOrganizations(): Promise<Organization[]> {
  return getJson('/organizations', organizationListSchema)
}

/** One organization; a non-member gets the same 404 as an unknown id. */
export function getOrganization(organizationId: string): Promise<Organization> {
  return getJson(`/organizations/${encodeURIComponent(organizationId)}`, organizationSchema)
}

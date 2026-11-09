/**
 * Backend paths of the tenant-scoped resources. Every API module builds its
 * URLs from these, so a change in URL shape touches only this file.
 */

/** Base path of every endpoint under one organization. */
export function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`
}

/** Base path of one Site (a `Project` in the API). */
export function sitePath(organizationId: string, siteId: string): string {
  return `${organizationPath(organizationId)}/projects/${encodeURIComponent(siteId)}`
}

/** Base path of one floor plan of a Site. */
export function floorPlanPath(organizationId: string, siteId: string, floorPlanId: string): string {
  return `${sitePath(organizationId, siteId)}/floor-plans/${encodeURIComponent(floorPlanId)}`
}

/**
 * The last Site the member opened in a Company, kept in this browser so
 * "Show me" on a Site step can open it after a reload. One key per Company,
 * so a Site never leaks into another Company's guide.
 */
const key = (organizationId: string) => `construx.guide.lastSite.${organizationId}`

export function readLastSite(organizationId: string): string | null {
  try {
    return localStorage.getItem(key(organizationId))
  } catch {
    return null
  }
}

export function rememberLastSite(organizationId: string, siteId: string): void {
  try {
    localStorage.setItem(key(organizationId), siteId)
  } catch {
    // Storage full or blocked: the guide just remembers it for this visit.
  }
}

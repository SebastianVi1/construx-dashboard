import type { Organization } from './organizationsApi'

/**
 * localStorage key for the selected organization, per user. This is a
 * convenience only: the server re-checks membership on every request.
 */
export function selectedOrganizationKey(userId: string): string {
  return `construx.organization.${userId}`
}

export function readSelectedId(storage: Pick<Storage, 'getItem'>, userId: string): string | null {
  try {
    return storage.getItem(selectedOrganizationKey(userId))
  } catch {
    return null
  }
}

export function writeSelectedId(storage: Pick<Storage, 'setItem'>, userId: string, organizationId: string): void {
  try {
    storage.setItem(selectedOrganizationKey(userId), organizationId)
  } catch {
    // Unavailable storage only loses the convenience.
  }
}

/** The stored organization while the user still belongs to it, else the first, else null. */
export function resolveSelectedOrganization(
  organizations: Organization[],
  storedId: string | null,
): Organization | null {
  return organizations.find((organization) => organization.id === storedId) ?? organizations[0] ?? null
}

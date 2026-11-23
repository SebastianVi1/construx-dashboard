import { formatMessage } from '../../i18n/format'
import type { Messages } from '../../i18n/messages'
import type { Scope } from '../permissions/can'
import type { CatalogAction, Grant, PermissionCatalog, RoleKind } from './rolesApi'

/** Why the caller may not edit a role (roles contract §8.3); the order mirrors the server's checks (§3). */
export type ReadOnlyReason = 'ownerLocked' | 'ownRole' | 'aboveCaller'

/**
 * The one-line reason shown on a role the server marked not `editable`. The
 * server decides; this only names which rule applied, from what the page knows.
 */
export function readOnlyReason(
  role: { code: string; kind: RoleKind; editable: boolean },
  myRoleCode: string | null,
): ReadOnlyReason | null {
  if (role.editable) return null
  if (role.kind === 'OWNER') return 'ownerLocked'
  if (role.code === myRoleCode) return 'ownRole'
  return 'aboveCaller'
}

export type PermissionRow = { action: CatalogAction; scope: Scope | null }

export type PermissionGroup = { key: string; names: { en: string; es: string }; rows: PermissionRow[] }

/** Every catalog action under its group, in catalog order, with the scope the role holds (null = None). */
export function permissionGroups(catalog: PermissionCatalog, grants: Grant[]): PermissionGroup[] {
  const held = new Map(grants.map((grant) => [grant.action, grant.scope]))
  return catalog.groups
    .map((group) => ({
      key: group.key,
      names: group.names,
      rows: catalog.actions
        .filter((action) => action.group === group.key)
        .map((action) => ({ action, scope: held.get(action.action) ?? null })),
    }))
    .filter((group) => group.rows.length > 0)
}

/** "12 members" in the current language; members counts ACTIVE and SUSPENDED memberships (§5.1). */
export function memberCountLabel(count: number, m: Messages): string {
  const t = m.roles.members
  if (count === 0) return t.none
  return count === 1 ? t.one : formatMessage(t.many, { count })
}

/** "1 pending invitation", or null when there are none. */
export function invitationCountLabel(count: number, m: Messages): string | null {
  const t = m.roles.invitations
  if (count === 0) return null
  return count === 1 ? t.one : formatMessage(t.many, { count })
}

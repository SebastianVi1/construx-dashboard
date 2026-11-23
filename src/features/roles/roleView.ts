import { formatMessage } from '../../i18n/format'
import type { Locale } from '../../i18n/locale'
import type { Messages } from '../../i18n/messages'
import { ApiError } from '../../lib/http'
import type { Scope } from '../permissions/can'
import { roleErrorKind, type CatalogAction, type Grant, type PermissionCatalog, type RoleKind } from './rolesApi'

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

/** A catalog action's name in the current language; null when the catalog does not know it. */
export function actionName(catalog: PermissionCatalog | null, action: string, locale: Locale): string | null {
  return catalog?.actions.find((entry) => entry.action === action)?.names[locale] ?? null
}

/**
 * What to tell someone whose role write failed (§5.12). A missing requirement
 * names both permissions from the problem's `action` and `requires`.
 */
export function roleErrorMessage(error: unknown, m: Messages, catalog: PermissionCatalog | null, locale: Locale): string {
  const t = m.roles.errors
  const kind = roleErrorKind(error)
  if (kind === 'roleDependencyMissing' && error instanceof ApiError) {
    const action = actionName(catalog, error.problemString('action') ?? '', locale)
    const requires = actionName(catalog, error.problemString('requires') ?? '', locale)
    return action && requires ? formatMessage(t.roleDependencyMissing, { action, requires }) : t.roleDependencyMissingGeneral
  }
  return t[kind]
}

/**
 * Where a ROLE_CHANGED came from: our save or our restore was refused (their
 * version then loads in the background), or their newer version simply arrived
 * while the user was editing.
 */
export type ConflictSource = 'save' | 'restore' | 'arrived'

/** Their version after our write was refused: still loading, on screen, or the load failed. */
export type TheirVersion = 'loading' | 'loaded' | 'failed'

export type ConflictPart =
  | 'notSaved'
  | 'notRestored'
  | 'unchanged'
  | 'newer'
  | 'loading'
  | 'loaded'
  | 'loadFailed'
  | 'kept'
  | 'saveAgain'
  | 'saveOrDiscard'
  | 'retryKept'
  | 'retry'

/**
 * The save bar's conflict text, as sentences of `roles.editor.conflict`: what
 * was refused, then the truth about their version (loading, loaded or not),
 * then what the user can do. `versionStale` is true while the page still holds
 * the version the server refused: saving with it would only be refused again.
 */
export function conflictNotice(
  source: ConflictSource,
  dirty: boolean,
  theirs: TheirVersion,
): { parts: ConflictPart[]; versionStale: boolean } {
  if (source === 'arrived') return { parts: ['newer'], versionStale: false }
  const lead: ConflictPart = !dirty ? 'unchanged' : source === 'save' ? 'notSaved' : 'notRestored'
  const parts: ConflictPart[] = [lead]
  if (theirs === 'loading') parts.push('loading', ...(dirty ? (['kept'] as const) : []))
  else if (theirs === 'failed') parts.push('loadFailed', dirty ? 'retryKept' : 'retry')
  else parts.push('loaded', ...(dirty ? ([source === 'save' ? 'saveAgain' : 'saveOrDiscard'] as const) : []))
  return { parts, versionStale: theirs !== 'loaded' }
}

/**
 * The sticky save bar shows on an editable role while there are unsaved
 * changes, a save error or a conflict, and right after a save made from it, so
 * the confirmation appears where the user pressed Save.
 */
export function saveBarShown(state: {
  editable: boolean
  dirty: boolean
  saveError: boolean
  conflict: boolean
  saved: boolean
}): boolean {
  return state.editable && (state.dirty || state.saveError || state.conflict || state.saved)
}

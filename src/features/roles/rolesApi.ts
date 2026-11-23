import { z } from 'zod'
import { ApiError, deleteJson, getJson, sendJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'
import { roleNamesSchema, scopeSchema } from '../permissions/can'

/** `OWNER` is locked, `BUILT_IN` comes from the definition file, `CUSTOM` was made by the company. */
export const roleKindSchema = z.enum(['OWNER', 'BUILT_IN', 'CUSTOM'])

export type RoleKind = z.infer<typeof roleKindSchema>

/** A role's description in each language; a Custom role without one sends nulls (or null). */
const roleDescriptionSchema = z.object({ en: z.string().nullable(), es: z.string().nullable() }).nullable()

/**
 * One entry of `GET /roles` (roles contract §5.1). `editable` and `assignable`
 * are the server's answer to "does this role fit within the caller" (§3); the
 * dashboard never recomputes them.
 */
export const roleSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  kind: roleKindSchema,
  name: z.string(),
  names: roleNamesSchema,
  description: roleDescriptionSchema,
  system: z.boolean(),
  customized: z.boolean(),
  memberCount: z.number().int(),
  pendingInvitationCount: z.number().int(),
  editable: z.boolean(),
  assignable: z.boolean(),
  version: z.number().int(),
})

export type RoleSummary = z.infer<typeof roleSummarySchema>

/** One (action, scope) pair a role holds. Actions are kept as strings: a newer backend may add some. */
export const grantSchema = z.object({ action: z.string().min(1), scope: scopeSchema })

export type Grant = z.infer<typeof grantSchema>

/**
 * `GET /roles/{code}` (§5.2): the summary plus its grants in catalog order,
 * for Built-in roles the file defaults, and what a delete would move: members
 * who left and invitations in any status.
 */
export const roleDetailSchema = roleSummarySchema.extend({
  permissions: z.array(grantSchema),
  defaults: z.array(grantSchema).nullable(),
  formerMemberCount: z.number().int(),
  invitationCount: z.number().int(),
})

export type RoleDetail = z.infer<typeof roleDetailSchema>

function rolePath(organizationId: string, code: string): string {
  return `${organizationPath(organizationId)}/roles/${encodeURIComponent(code)}`
}

/** Roles of the company: Owner, then Built-in roles in file order, then Custom roles by name. */
export function listRoles(organizationId: string): Promise<RoleSummary[]> {
  return getJson(`${organizationPath(organizationId)}/roles`, z.array(roleSummarySchema))
}

export function getRole(organizationId: string, code: string): Promise<RoleDetail> {
  return getJson(rolePath(organizationId, code), roleDetailSchema)
}

/**
 * Body of a create or edit. `name` and `description` belong to Custom roles
 * only: leave them out for a Built-in role (§5.4, `ROLE_NAME_FIXED`).
 */
export type RoleDraft = { name?: string; description?: string | null; permissions: Grant[] }

function draftBody(draft: RoleDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (draft.name !== undefined) body.name = draft.name.trim()
  if (draft.description !== undefined) body.description = draft.description?.trim() || null
  body.permissions = draft.permissions
  return body
}

/** Creates a Custom role (§5.3); the server generates its `CUSTOM_…` code. */
export function createRole(organizationId: string, draft: RoleDraft & { name: string }): Promise<RoleDetail> {
  return sendJson('post', `${organizationPath(organizationId)}/roles`, draftBody(draft), 201, roleDetailSchema)
}

/** Replaces the role's permissions (and a Custom role's name and description); a stale `version` is `ROLE_CHANGED`. */
export function updateRole(organizationId: string, code: string, draft: RoleDraft, version: number): Promise<RoleDetail> {
  return sendJson('put', rolePath(organizationId, code), { ...draftBody(draft), version }, 200, roleDetailSchema)
}

/** Puts a Built-in role back to the definition-file defaults (§5.5). */
export function restoreRole(organizationId: string, code: string, version: number): Promise<RoleDetail> {
  return sendJson('post', `${rolePath(organizationId, code)}/restore-defaults`, { version }, 200, roleDetailSchema)
}

/** Deletes a Custom role (§5.6); a held role needs a `replacement` its members and invitations move to. */
export function deleteRole(organizationId: string, code: string, replacement?: string): Promise<void> {
  const query = replacement ? `?replacement=${encodeURIComponent(replacement)}` : ''
  return deleteJson(`${rolePath(organizationId, code)}${query}`)
}

/**
 * How far a requirement must reach (§5.10): `SAME` = at least the granted
 * scope, `PROJECT` = at least max(granted, PROJECT), `ORGANIZATION` = company-wide.
 */
export const minScopeSchema = z.enum(['SAME', 'PROJECT', 'ORGANIZATION'])

export const catalogActionSchema = z.object({
  action: z.string().min(1),
  group: z.string().min(1),
  names: roleNamesSchema,
  descriptions: roleNamesSchema,
  scopes: z.array(scopeSchema).min(1),
  requires: z.array(z.object({ action: z.string().min(1), minScope: minScopeSchema })),
})

export type CatalogAction = z.infer<typeof catalogActionSchema>

/** `GET /api/permissions/catalog`: groups and actions, each in display order. */
export const permissionCatalogSchema = z.object({
  groups: z.array(z.object({ key: z.string().min(1), names: roleNamesSchema })),
  actions: z.array(catalogActionSchema),
})

export type PermissionCatalog = z.infer<typeof permissionCatalogSchema>

let catalogRequest: Promise<PermissionCatalog> | null = null

/** The permission catalog is static per deploy: fetched once per session; a failure is asked again next time. */
export function getCatalog(): Promise<PermissionCatalog> {
  if (!catalogRequest) {
    const request = getJson('/permissions/catalog', permissionCatalogSchema)
    catalogRequest = request
    request.catch(() => {
      if (catalogRequest === request) catalogRequest = null
    })
  }
  return catalogRequest
}

/** Drop the remembered catalog (tests, or a deploy that changed it). */
export function forgetCatalog(): void {
  catalogRequest = null
}

/** Role rule failures (§5.12), keyed by `ProblemDetail.code`. */
const roleErrorCodes = {
  ROLE_ABOVE_CALLER: 'roleAboveCaller',
  ROLE_OWN: 'roleOwn',
  ROLE_OWNER_LOCKED: 'roleOwnerLocked',
  ROLE_SCOPE_INVALID: 'roleScopeInvalid',
  ROLE_DEPENDENCY_MISSING: 'roleDependencyMissing',
  ROLE_NAME_INVALID: 'roleNameInvalid',
  ROLE_NAME_FIXED: 'roleNameFixed',
  ROLE_NAME_TAKEN: 'roleNameTaken',
  ROLE_LIMIT_REACHED: 'roleLimitReached',
  ROLE_CHANGED: 'roleChanged',
  ROLE_NOT_BUILT_IN: 'roleNotBuiltIn',
  ROLE_BUILT_IN_UNDELETABLE: 'roleBuiltInUndeletable',
  ROLE_REPLACEMENT_REQUIRED: 'roleReplacementRequired',
  ROLE_REPLACEMENT_INVALID: 'roleReplacementInvalid',
} as const

export type RoleErrorKind = (typeof roleErrorCodes)[keyof typeof roleErrorCodes] | 'session' | 'forbidden' | 'notFound' | 'generic'

/** Message kind for a failed roles request: the §5.12 rule when the server names one, else the status. */
export function roleErrorKind(error: unknown): RoleErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code && Object.hasOwn(roleErrorCodes, error.code)) {
    return roleErrorCodes[error.code as keyof typeof roleErrorCodes]
  }
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

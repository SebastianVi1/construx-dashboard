import { z } from 'zod'

export const permissionActions = [
  'MANAGE_ORGANIZATION',
  'MANAGE_ROLES',
  'MANAGE_MEMBERS',
  'VIEW_PROJECT',
  'MANAGE_PROJECT',
  'VIEW_GOAL',
  'MANAGE_GOAL',
  'VIEW_ACTIVITY',
  'MANAGE_ACTIVITY',
  'ASSIGN_ACTIVITY',
  'VIEW_PRICES',
  'MANAGE_PRICES',
  'VIEW_BUDGET',
  'MANAGE_BUDGET',
  'VIEW_PLAN',
  'MANAGE_PLAN',
] as const

export type PermissionAction = (typeof permissionActions)[number]

export const roleSchema = z.object({ code: z.string(), name: z.string() })

export type RoleRef = z.infer<typeof roleSchema>

/** `GET /api/organizations/{id}/me`: the caller's role and grants, for UI gating only. */
export const myAccessSchema = z.object({
  membershipId: z.string().min(1),
  role: roleSchema,
  permissions: z.array(
    z.object({
      // Unknown actions are kept (a newer backend may add some); scopes are a closed set.
      action: z.string(),
      scope: z.enum(['ORGANIZATION', 'PROJECT', 'OWN']),
    }),
  ),
})

export type MyAccess = z.infer<typeof myAccessSchema>

export type CanOptions = {
  /** Set when the caller's own site access is known; `false` denies `PROJECT` scope. */
  onSite?: boolean
  /** The task belongs to the caller; required for `OWN` scope. */
  own?: boolean
}

/**
 * Whether the UI should offer an action. `ORGANIZATION` scope always passes;
 * `PROJECT` scope passes on a site the server returned to the caller (the
 * site list is already filtered to their sites) unless `onSite` says
 * otherwise; `OWN` scope passes only for the caller's own task on a site.
 * Unknown permissions deny. The server still checks every request.
 */
export function canPerform(
  access: MyAccess | null,
  action: PermissionAction,
  projectId?: string,
  options: CanOptions = {},
): boolean {
  if (!access) return false
  const grant = access.permissions.find((permission) => permission.action === action)
  if (!grant) return false
  if (grant.scope === 'ORGANIZATION') return true
  if (!projectId) return false
  if (grant.scope === 'PROJECT') return options.onSite !== false
  return options.own === true
}

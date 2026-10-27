import type { MyAccess, PermissionAction } from './can'

/** The role holds the action at any scope (for showing a destination, not a per-site action). */
export function hasPermission(access: MyAccess | null, action: PermissionAction): boolean {
  return access?.permissions.some((permission) => permission.action === action) ?? false
}

/**
 * First workspace screen after sign-in. A role that manages tasks only at
 * `OWN` scope (the seeded Worker) starts on its own tasks; everyone else on
 * the site list.
 */
export function landingPath(access: MyAccess | null): '/tasks' | '/sites' {
  const grants = access?.permissions.filter((permission) => permission.action === 'MANAGE_ACTIVITY') ?? []
  return grants.length > 0 && grants.every((grant) => grant.scope === 'OWN') ? '/tasks' : '/sites'
}

import type { MyAccess } from '../permissions/can'

/** Workbooks hold company finances: only roles that see the budget company-wide open them. */
export function seesWorkbooks(access: MyAccess | null): boolean {
  return access?.permissions.some((permission) => permission.action === 'VIEW_BUDGET' && permission.scope === 'ORGANIZATION') ?? false
}

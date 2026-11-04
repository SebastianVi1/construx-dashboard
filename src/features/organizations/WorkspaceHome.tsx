import { Navigate } from 'react-router'
import { usePermissions } from '../permissions'
import { workspaceHomePath } from '../org-finance/orgFinanceAccess'

/**
 * `/`, the default after sign-in: roles with company-wide VIEW_BUDGET start
 * on the finance dashboard, a Worker (tasks managed only at `OWN` scope) on
 * My tasks, everyone else on the site list. Rendered by `WorkspaceLayout`
 * only once permissions are loaded.
 */
export function WorkspaceHome() {
  const { access } = usePermissions()
  return <Navigate to={workspaceHomePath(access)} replace />
}

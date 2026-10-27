import { Navigate } from 'react-router'
import { usePermissions } from '../permissions'
import { landingPath } from '../permissions/landing'

/**
 * `/`, the default after sign-in: a Worker (tasks managed only at `OWN`
 * scope) starts on My tasks, everyone else on the site list. Rendered by
 * `WorkspaceLayout` only once permissions are loaded.
 */
export function WorkspaceHome() {
  const { access } = usePermissions()
  return <Navigate to={landingPath(access)} replace />
}

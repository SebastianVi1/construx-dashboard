import type { ReactNode } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { canPerform } from './can'
import { PermissionsContext } from './permissions-context'
import { getMyAccess } from './permissionsApi'

/**
 * Loads `GET /api/organizations/{id}/me` for one organization. Key it by the
 * organization id so a company switch starts from "no permissions".
 */
export function PermissionsProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const remote = useRemoteData(organizationId, () => getMyAccess(organizationId))
  const access = remote.data ?? null

  return (
    <PermissionsContext.Provider
      value={{
        status: remote.status,
        error: remote.error,
        access,
        can: (action, projectId, options) => canPerform(access, action, projectId, options),
        reload: remote.reload,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

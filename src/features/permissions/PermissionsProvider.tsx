import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { watchAccessFreshness, type AccessFreshness } from './accessRefresh'
import { canPerform } from './can'
import { PermissionsContext } from './permissions-context'
import { getMyAccess } from './permissionsApi'

/**
 * Loads `GET /api/organizations/{id}/me` for one organization. Key it by the
 * organization id so a company switch starts from "no permissions". It reads
 * `/me` again when the member comes back to the tab or changes screen (at most
 * every 30 s), so a role edit reaches them without a reload.
 */
export function PermissionsProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  // Immediate: this gates the screen below, which shows its own shaped placeholder.
  const remote = useRemoteData(organizationId, () => getMyAccess(organizationId), { immediate: true })
  const access = remote.data ?? null
  const { pathname } = useLocation()
  const freshness = useRef<AccessFreshness | null>(null)
  const reload = useEffectEvent(() => remote.reload())

  useEffect(() => {
    const watcher = watchAccessFreshness({
      page: document,
      isVisible: () => document.visibilityState === 'visible',
      reload,
    })
    freshness.current = watcher
    return () => {
      watcher.stop()
      freshness.current = null
    }
  }, [])

  useEffect(() => {
    freshness.current?.routeChanged()
  }, [pathname])

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

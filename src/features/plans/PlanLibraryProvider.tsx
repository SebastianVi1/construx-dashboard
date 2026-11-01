import { useEffect, useEffectEvent, type ReactNode } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { hasPermission } from '../permissions/landing'
import { getPlanLibrary } from './planLibraryApi'
import { PlanLibraryContext } from './planLibraryContext'

/** One organization-keyed snapshot shared by navigation and the page; refetch on focus. */
export function PlanLibraryProvider({ children }: { children: ReactNode }) {
  const org = useCurrentOrganization()
  const { access, status } = usePermissions()
  const enabled = status === 'ready' && hasPermission(access, 'VIEW_PLAN')
  const remote = useRemoteData(enabled ? `${org.id}:plans` : null, () => getPlanLibrary(org.id))
  const refresh = useEffectEvent(() => remote.reload())
  useEffect(() => {
    if (!enabled) return
    const focus = () => refresh()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [enabled])
  return <PlanLibraryContext.Provider value={remote}>{children}</PlanLibraryContext.Provider>
}

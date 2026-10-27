import { createContext, useContext } from 'react'
import type { RemoteStatus } from '../../components/data/useRemoteData'
import type { CanOptions, MyAccess, PermissionAction } from './can'

export type PermissionsContextValue = {
  status: RemoteStatus
  error: unknown
  /** The caller's membership in the selected organization, null until loaded. */
  access: MyAccess | null
  /** UI gating only: hide or disable what the role lacks. The server stays the authority. */
  can: (action: PermissionAction, projectId?: string, options?: CanOptions) => boolean
  reload: () => void
}

export const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function usePermissions(): PermissionsContextValue {
  const context = useContext(PermissionsContext)
  if (!context) throw new Error('usePermissions must be used within a PermissionsProvider')
  return context
}

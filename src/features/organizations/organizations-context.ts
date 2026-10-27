import { createContext, useContext } from 'react'
import type { Organization } from './organizationsApi'

export type OrganizationsStatus = 'idle' | 'loading' | 'ready' | 'error'

export type OrganizationsContextValue = {
  /** `idle` while signed out; `ready` once `GET /api/organizations` answered. */
  status: OrganizationsStatus
  organizations: Organization[]
  /** Selected organization: the stored choice if still a member, else the first, else null. */
  current: Organization | null
  select: (organizationId: string) => void
  /** Add a just-created organization and select it, without refetching. */
  add: (organization: Organization) => void
  reload: () => void
}

export const OrganizationsContext = createContext<OrganizationsContextValue | undefined>(undefined)

export function useOrganizations(): OrganizationsContextValue {
  const context = useContext(OrganizationsContext)
  if (!context) throw new Error('useOrganizations must be used within an OrganizationsProvider')
  return context
}

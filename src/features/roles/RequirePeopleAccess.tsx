import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { peoplePageRedirect } from '../organizations/workspaceNav'
import { usePermissions } from '../permissions'
import { landingPath } from '../permissions/landing'
import { peopleAccess } from './peopleAccess'

/**
 * Lets in callers who may open this People page: Members needs MANAGE_MEMBERS,
 * Roles & permissions MANAGE_ROLES or MANAGE_MEMBERS. A roles-only manager is
 * sent from Members to Roles; anyone else to their landing screen.
 */
export function RequirePeopleAccess({ page, children }: { page: 'members' | 'roles'; children: ReactNode }) {
  const { access, can } = usePermissions()
  const redirect = peoplePageRedirect(page, peopleAccess(can))
  if (redirect === 'away') return <Navigate to={landingPath(access)} replace />
  if (redirect) return <Navigate to={redirect} replace />
  return children
}

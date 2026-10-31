import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { usePermissions } from '../permissions'
import { landingPath } from '../permissions/landing'
import { seesWorkbooks } from './excelAccess'

/** Sends roles without company-wide `VIEW_BUDGET` to their landing screen. */
export function RequireWorkbooks({ children }: { children: ReactNode }) {
  const { access } = usePermissions()
  if (!seesWorkbooks(access)) return <Navigate to={landingPath(access)} replace />
  return children
}

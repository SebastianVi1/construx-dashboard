import { useEffect, useEffectEvent } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { forgetSessionValue, readSessionValue, writeSessionValue } from '../../lib/sessionCache'
import { listRoles, roleSummarySchema, type RoleDetail, type RoleSummary } from './rolesApi'

/** Key of a company's `GET /roles` list in `useRemoteData` and the session cache. */
export function rolesKey(organizationId: string): string {
  return `${organizationId}:roles`
}

/** Key of one role's `GET /roles/{code}` detail. */
export function roleKey(organizationId: string, code: string): string {
  return `${organizationId}:role:${code}`
}

/** The list with `role` in place of the entry with its code, or added at the end. */
export function withRole(roles: RoleSummary[], role: RoleSummary): RoleSummary[] {
  return roles.some((entry) => entry.code === role.code)
    ? roles.map((entry) => (entry.code === role.code ? role : entry))
    : [...roles, role]
}

export function withoutRole(roles: RoleSummary[], code: string): RoleSummary[] {
  return roles.filter((entry) => entry.code !== code)
}

/** A role detail as a list entry: the summary fields only. */
export function summaryOf(role: RoleDetail): RoleSummary {
  return roleSummarySchema.parse(role)
}

type Listener = (organizationId: string) => void

const listeners = new Set<Listener>()

/** Hear every {@link rolesChanged}; returns the function that stops listening. */
export function onRolesChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * After any role write or assignment (roles contract §8.5): the remembered list
 * takes `change` at once, so the next screen starts from it, and every mounted
 * roles list of the company fetches `GET /roles` again for the server's counts
 * and flags. A list mounted later revalidates on its own.
 */
export function rolesChanged(organizationId: string, change?: (roles: RoleSummary[]) => RoleSummary[]): void {
  const cached = readSessionValue<RoleSummary[]>(rolesKey(organizationId))
  if (change && cached) writeSessionValue(rolesKey(organizationId), change(cached))
  for (const listener of [...listeners]) listener(organizationId)
}

/**
 * A role was deleted: its page is forgotten, so going back to it loads it again
 * (and finds it gone) instead of showing the remembered role as live, and the
 * lists drop it at once and refetch (see {@link rolesChanged}).
 */
export function roleDeleted(organizationId: string, code: string): void {
  forgetSessionValue(roleKey(organizationId, code))
  rolesChanged(organizationId, (roles) => withoutRole(roles, code))
}

/** The company's roles list, fetched again whenever {@link rolesChanged} names the company. */
export function useRoles(organizationId: string) {
  const roles = useRemoteData(rolesKey(organizationId), () => listRoles(organizationId))
  const heard = useEffectEvent((changed: string) => {
    if (changed === organizationId) roles.reload()
  })
  useEffect(() => onRolesChanged(heard), [])
  return roles
}

import type { PeopleAccess } from '../organizations/workspaceNav'

/** The caller's People permissions, from `can` (company-wide grants only). */
export function peopleAccess(can: (action: 'MANAGE_MEMBERS' | 'MANAGE_ROLES') => boolean): PeopleAccess {
  return { managesMembers: can('MANAGE_MEMBERS'), managesRoles: can('MANAGE_ROLES') }
}

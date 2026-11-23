/** A destination of the workspace navigation; `key` names its label in `messages.workspace`. */
export type WorkspaceNavLink = {
  key: 'finance' | 'sites' | 'myTasks' | 'prices' | 'excel' | 'documents' | 'members' | 'roles'
  to: string
}

/** A heading over sub-pages (the sidebar indents them; the phone tab bar shows one tab opening `to`, the first child). */
export type WorkspaceNavGroup = { key: 'people'; to: string; children: WorkspaceNavLink[] }

export type WorkspaceNavItem = WorkspaceNavLink | WorkspaceNavGroup

export type WorkspaceSection = { key: Exclude<WorkspaceNavLink['key'], 'members' | 'roles'> | 'people' | 'account'; to: string; isRoot: boolean }

export type PeopleAccess = {
  /** Company-wide MANAGE_MEMBERS. */
  managesMembers: boolean
  /** Company-wide MANAGE_ROLES. */
  managesRoles: boolean
}

/** People sub-pages the role may open: Members with MANAGE_MEMBERS, Roles & permissions with either (roles contract §8.1). */
export function peopleChildren({ managesMembers, managesRoles }: PeopleAccess): WorkspaceNavLink[] {
  const children: WorkspaceNavLink[] = []
  if (managesMembers) children.push({ key: 'members', to: '/members' })
  if (managesMembers || managesRoles) children.push({ key: 'roles', to: '/members/roles' })
  return children
}

/**
 * Where a People page sends a caller who may not open it: null lets them in,
 * a path redirects to the sibling page they may open, `away` means their landing screen.
 */
export function peoplePageRedirect(page: 'members' | 'roles', access: PeopleAccess): string | null | 'away' {
  const children = peopleChildren(access)
  if (children.some((child) => child.key === page)) return null
  return children[0]?.to ?? 'away'
}

/** Destinations the role can open, in display order. Sites is always present; Finance, the company landing, leads when allowed. */
export function workspaceNavItems({
  seesFinance = false,
  seesOwnTasks,
  seesPrices,
  seesBudget,
  managesMembers,
  managesRoles,
}: {
  /** Company-wide VIEW_BUDGET: the organization finance dashboard. */
  seesFinance?: boolean
  seesOwnTasks: boolean
  seesPrices: boolean
  seesBudget: boolean
  managesMembers: boolean
  managesRoles: boolean
}): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = []
  if (seesFinance) items.push({ key: 'finance', to: '/finance' })
  items.push({ key: 'sites', to: '/sites' })
  if (seesOwnTasks) items.push({ key: 'myTasks', to: '/tasks' })
  if (seesPrices) items.push({ key: 'prices', to: '/prices' })
  if (seesBudget) items.push({ key: 'excel', to: '/excel' })
  items.push({ key: 'documents', to: '/documents' })
  const people = peopleChildren({ managesMembers, managesRoles })
  if (people.length > 0) items.push({ key: 'people', to: people[0].to, children: people })
  return items
}

const sections: Omit<WorkspaceSection, 'isRoot'>[] = [
  { key: 'finance', to: '/finance' },
  { key: 'sites', to: '/sites' },
  { key: 'myTasks', to: '/tasks' },
  { key: 'prices', to: '/prices' },
  { key: 'excel', to: '/excel' },
  { key: 'documents', to: '/documents' },
  // Most specific first: the roles pages are their own root under People.
  { key: 'people', to: '/members/roles' },
  { key: 'people', to: '/members' },
  { key: 'account', to: '/account' },
]

/** The section a path belongs to, for the header breadcrumb; null outside any section. */
export function sectionForPath(pathname: string): WorkspaceSection | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const section of sections) {
    if (path === section.to) return { ...section, isRoot: true }
    if (path.startsWith(`${section.to}/`)) return { ...section, isRoot: false }
  }
  return null
}

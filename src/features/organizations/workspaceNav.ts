/** A destination of the workspace navigation; `key` names its label in `messages.workspace`. */
export type WorkspaceNavItem = { key: 'finance' | 'sites' | 'myTasks' | 'materials' | 'excel' | 'members' | 'documents'; to: string }

export type WorkspaceSection = { key: WorkspaceNavItem['key'] | 'account'; to: string; isRoot: boolean }

/** Destinations the role can open, in display order. Sites is always present; Finance, the company landing, leads when allowed. */
export function workspaceNavItems({
  seesFinance = false,
  seesOwnTasks,
  seesPrices,
  seesBudget,
  managesMembers,
}: {
  /** Company-wide VIEW_BUDGET: the organization finance dashboard. */
  seesFinance?: boolean
  seesOwnTasks: boolean
  seesPrices: boolean
  seesBudget: boolean
  managesMembers: boolean
}): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = []
  if (seesFinance) items.push({ key: 'finance', to: '/finance' })
  items.push({ key: 'sites', to: '/sites' })
  if (seesOwnTasks) items.push({ key: 'myTasks', to: '/tasks' })
  if (seesPrices) items.push({ key: 'materials', to: '/materials' })
  if (seesBudget) items.push({ key: 'excel', to: '/excel' })
  items.push({ key: 'documents', to: '/documents' })
  if (managesMembers) items.push({ key: 'members', to: '/members' })
  return items
}

const sections: Omit<WorkspaceSection, 'isRoot'>[] = [
  { key: 'finance', to: '/finance' },
  { key: 'sites', to: '/sites' },
  { key: 'myTasks', to: '/tasks' },
  { key: 'materials', to: '/materials' },
  { key: 'excel', to: '/excel' },
  { key: 'documents', to: '/documents' },
  { key: 'members', to: '/members' },
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

/** A destination of the workspace navigation; `key` names its label in `messages.workspace`. */
export type WorkspaceNavItem = { key: 'sites' | 'myTasks' | 'materials' | 'excel' | 'plans' | 'members'; to: string }

export type WorkspaceSection = { key: WorkspaceNavItem['key'] | 'account'; to: string; isRoot: boolean }

/** Destinations the role can open, in display order. Sites is always present. */
export function workspaceNavItems({
  seesOwnTasks,
  seesPrices,
  seesBudget,
  managesMembers,
  seesPlans = false,
}: {
  seesOwnTasks: boolean
  seesPrices: boolean
  seesBudget: boolean
  managesMembers: boolean
  seesPlans?: boolean
}): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = [{ key: 'sites', to: '/sites' }]
  if (seesOwnTasks) items.push({ key: 'myTasks', to: '/tasks' })
  if (seesPrices) items.push({ key: 'materials', to: '/materials' })
  if (seesBudget) items.push({ key: 'excel', to: '/excel' })
  if (seesPlans) items.push({ key: 'plans', to: '/plans' })
  if (managesMembers) items.push({ key: 'members', to: '/members' })
  return items
}

const sections: Omit<WorkspaceSection, 'isRoot'>[] = [
  { key: 'sites', to: '/sites' },
  { key: 'myTasks', to: '/tasks' },
  { key: 'materials', to: '/materials' },
  { key: 'excel', to: '/excel' },
  { key: 'plans', to: '/plans' },
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

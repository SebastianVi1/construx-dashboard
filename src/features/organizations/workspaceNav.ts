/** A destination of the workspace navigation; `key` names its label in `messages.workspace`. */
export type WorkspaceNavItem = { key: 'sites' | 'myTasks' | 'members'; to: string }

export type WorkspaceSection = { key: WorkspaceNavItem['key'] | 'account'; to: string; isRoot: boolean }

/** Destinations the role can open, in display order. Sites is always present. */
export function workspaceNavItems({
  seesOwnTasks,
  managesMembers,
}: {
  seesOwnTasks: boolean
  managesMembers: boolean
}): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = [{ key: 'sites', to: '/sites' }]
  if (seesOwnTasks) items.push({ key: 'myTasks', to: '/tasks' })
  if (managesMembers) items.push({ key: 'members', to: '/members' })
  return items
}

const sections: Omit<WorkspaceSection, 'isRoot'>[] = [
  { key: 'sites', to: '/sites' },
  { key: 'myTasks', to: '/tasks' },
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

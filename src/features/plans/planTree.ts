import type { PlanFolder } from './planLibraryApi'

export function folderPath(folders: PlanFolder[], id: string | null): PlanFolder[] {
  const path: PlanFolder[] = []
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = folders.find(item => item.id === id)
    if (!folder) break
    path.unshift(folder)
    id = folder.parentId
  }
  return path
}

export function folderRows(folders: PlanFolder[], expanded: ReadonlySet<string>) {
  const rows: { folder: PlanFolder; level: number; hasChildren: boolean }[] = []
  const seen = new Set<string>()
  function visit(parent: string | null, level: number) {
    for (const folder of folders.filter(f => f.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(folder.id)) continue
      seen.add(folder.id)
      rows.push({ folder, level, hasChildren: folders.some(f => f.parentId === folder.id) })
      if (expanded.has(folder.id)) visit(folder.id, level + 1)
    }
  }
  visit(null, 0)
  return rows
}

export function plansInFolder<T extends { folderId?: string | null }>(plans: T[], id: string | null): T[] {
  return plans.filter(plan => (plan.folderId ?? null) === id)
}

export function planFolderHref(id: string | null) {
  return id ? `/plans/folders/${encodeURIComponent(id)}` : '/plans'
}

export function folderOptions(folders: PlanFolder[], rootLabel: string, excludeId?: string) {
  return [{ value: '', label: rootLabel }, ...folders
    .filter(folder => !folderPath(folders, folder.id).some(parent => parent.id === excludeId))
    .map(folder => ({ value: folder.id, label: folderPath(folders, folder.id).map(part => part.name).join(' / ') }))
    .sort((a, b) => a.label.localeCompare(b.label))]
}

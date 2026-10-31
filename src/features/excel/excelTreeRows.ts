import type { ExcelFolder, TreeWorkbook } from './excelModel'
import { folderContents } from './excelTree'

/** One visible line of a folder tree; `level` 0 is a direct child of the tree's starting folder. */
export type TreeRow<W extends TreeWorkbook = TreeWorkbook> =
  | { kind: 'folder'; folder: ExcelFolder; level: number; expanded: boolean; hasChildren: boolean }
  | { kind: 'workbook'; workbook: W; level: number }

/**
 * The lines a tree shows from `rootId` (null for the library root): each folder's sub-folders,
 * then its workbooks, by name, with the content of expanded folders right under them.
 */
export function treeRows<W extends TreeWorkbook>(
  tree: { folders: ExcelFolder[]; workbooks: W[] },
  rootId: string | null,
  expanded: ReadonlySet<string>,
  level = 0,
): TreeRow<W>[] {
  const { folders, workbooks, counts } = folderContents(tree, rootId)
  const rows: TreeRow<W>[] = []
  for (const folder of folders) {
    const count = counts.get(folder.id)
    const isExpanded = expanded.has(folder.id)
    rows.push({ kind: 'folder', folder, level, expanded: isExpanded, hasChildren: (count?.folders ?? 0) + (count?.workbooks ?? 0) > 0 })
    if (isExpanded) rows.push(...treeRows(tree, folder.id, expanded, level + 1))
  }
  for (const workbook of workbooks) rows.push({ kind: 'workbook', workbook, level })
  return rows
}

export function toggleExpanded(expanded: ReadonlySet<string>, folderId: string): Set<string> {
  const next = new Set(expanded)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  return next
}

/** The open folders as stored in localStorage; anything unreadable counts as none open. */
export function parseExpanded(raw: string | null): Set<string> {
  try {
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

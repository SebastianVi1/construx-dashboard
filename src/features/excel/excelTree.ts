import type { ExcelFolder, ExcelTree, TreeWorkbook } from './excelModel'

/** A root-level folder is depth 1. */
export const MAX_FOLDER_DEPTH = 3
export const MAX_FOLDERS = 100
export const MAX_FOLDER_NAME = 60

/**
 * Why a folder change is refused. Every storage adapter checks these same rules,
 * so moving the library to another backend cannot change what is allowed.
 */
export type TreeIssue = 'nameInvalid' | 'nameTaken' | 'tooDeep' | 'cycle' | 'folderLimit' | 'sameLocation' | 'notFound'

export type FolderCounts = { folders: number; workbooks: number }

/** What deleting a folder removes: the folder itself, everything under it, and how much of it is unexported. */
export type DeleteSummary = { folderIds: string[]; workbookIds: string[]; subfolders: number; unexported: number }

/** The library page that shows a folder; the root is `/excel`. */
export function folderHref(folderId: string | null): string {
  return folderId === null ? '/excel' : `/excel/folders/${encodeURIComponent(folderId)}`
}

/** The folders from the root down to `folderId`, for the breadcrumb; empty for the root or a missing folder. */
export function folderPath(folders: ExcelFolder[], folderId: string | null): ExcelFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: ExcelFolder[] = []
  let current = folderId === null ? undefined : byId.get(folderId)
  while (current && path.length <= folders.length) {
    path.unshift(current)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return path
}

/** The direct sub-folders and workbooks of a folder, sorted by name, with each sub-folder's own counts. */
export function folderContents<W extends TreeWorkbook>(tree: { folders: ExcelFolder[]; workbooks: W[] }, folderId: string | null) {
  const counts = new Map<string, FolderCounts>()
  const folders = tree.folders.filter((folder) => folder.parentId === folderId).sort(byName)
  for (const folder of folders) {
    counts.set(folder.id, {
      folders: tree.folders.filter((item) => item.parentId === folder.id).length,
      workbooks: tree.workbooks.filter((item) => item.folderId === folder.id).length,
    })
  }
  const workbooks = tree.workbooks.filter((workbook) => workbook.folderId === folderId).sort(byName)
  return { folders, workbooks, counts }
}

/** Whether any folder can be created in `parentId`, before a name is typed. */
export function newFolderIssue(tree: ExcelTree, parentId: string | null): TreeIssue | null {
  if (parentId !== null && !findFolder(tree.folders, parentId)) return 'notFound'
  if (depth(tree.folders, parentId) + 1 > MAX_FOLDER_DEPTH) return 'tooDeep'
  if (tree.folders.length >= MAX_FOLDERS) return 'folderLimit'
  return null
}

export function createFolderIssue(tree: ExcelTree, parentId: string | null, name: string): TreeIssue | null {
  return newFolderIssue(tree, parentId) ?? nameIssue(tree.folders, parentId, name, null)
}

export function renameFolderIssue(folders: ExcelFolder[], folderId: string, name: string): TreeIssue | null {
  const folder = findFolder(folders, folderId)
  if (!folder) return 'notFound'
  return nameIssue(folders, folder.parentId, name, folderId)
}

/** Also used to grey out the destinations of the "Move to" dialog. */
export function moveFolderIssue(folders: ExcelFolder[], folderId: string, targetId: string | null): TreeIssue | null {
  const folder = findFolder(folders, folderId)
  if (!folder || (targetId !== null && !findFolder(folders, targetId))) return 'notFound'
  if (folder.parentId === targetId) return 'sameLocation'
  if (targetId !== null && subtreeIds(folders, folderId).includes(targetId)) return 'cycle'
  if (depth(folders, targetId) + height(folders, folderId) > MAX_FOLDER_DEPTH) return 'tooDeep'
  return nameIssue(folders, targetId, folder.name, folderId)
}

export function moveWorkbookIssue(tree: ExcelTree, workbookId: string, targetId: string | null): TreeIssue | null {
  const workbook = tree.workbooks.find((item) => item.id === workbookId)
  if (!workbook || (targetId !== null && !findFolder(tree.folders, targetId))) return 'notFound'
  if (workbook.folderId === targetId) return 'sameLocation'
  return null
}

export function deleteSummary(tree: ExcelTree, folderId: string): DeleteSummary {
  const folderIds = findFolder(tree.folders, folderId) ? subtreeIds(tree.folders, folderId) : []
  const inside = tree.workbooks.filter((workbook) => workbook.folderId !== null && folderIds.includes(workbook.folderId))
  return {
    folderIds,
    workbookIds: inside.map((workbook) => workbook.id),
    subfolders: Math.max(folderIds.length - 1, 0),
    unexported: inside.filter((workbook) => workbook.dirty).length,
  }
}

/** Trimmed, as folder names are stored. */
export function folderName(name: string): string {
  return name.trim()
}

function nameIssue(folders: ExcelFolder[], parentId: string | null, name: string, selfId: string | null): TreeIssue | null {
  const trimmed = folderName(name)
  if (trimmed.length === 0 || trimmed.length > MAX_FOLDER_NAME) return 'nameInvalid'
  const key = trimmed.toLocaleLowerCase()
  const taken = folders.some(
    (folder) => folder.parentId === parentId && folder.id !== selfId && folder.name.toLocaleLowerCase() === key,
  )
  return taken ? 'nameTaken' : null
}

function findFolder(folders: ExcelFolder[], folderId: string): ExcelFolder | undefined {
  return folders.find((folder) => folder.id === folderId)
}

/** Levels from the root to the folder: 0 for the root, 1 for a root-level folder. */
function depth(folders: ExcelFolder[], folderId: string | null): number {
  return folderPath(folders, folderId).length
}

/** Levels the folder and its sub-folders take: 1 for a folder with no sub-folders. */
function height(folders: ExcelFolder[], folderId: string): number {
  const children = folders.filter((folder) => folder.parentId === folderId)
  return 1 + Math.max(0, ...children.map((child) => height(folders, child.id)))
}

/** The folder and every folder under it. */
function subtreeIds(folders: ExcelFolder[], folderId: string): string[] {
  const ids = [folderId]
  for (let index = 0; index < ids.length; index++) {
    for (const folder of folders) {
      if (folder.parentId === ids[index] && !ids.includes(folder.id)) ids.push(folder.id)
    }
  }
  return ids
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

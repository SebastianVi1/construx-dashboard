import type { ExcelTree } from './excelModel'
import type { TreeIssue } from './excelTree'
import { moveFolderIssue, moveWorkbookIssue } from './excelTree'

/** Marks a drag that started on a library row, so it is a move and never an upload. */
export const ITEM_DRAG_TYPE = 'application/x-construx-excel-item'

export type DragItem = { kind: 'folder' | 'workbook'; id: string }

/**
 * What is being dragged, from the only thing a browser exposes before the drop: the data types.
 * `files` comes from the computer and uploads; `item` is a library row and moves.
 */
export function dragKind(types: readonly string[]): 'files' | 'item' | null {
  if (types.includes(ITEM_DRAG_TYPE)) return 'item'
  if (types.includes('Files')) return 'files'
  return null
}

/** Whether `item` may be dropped on the folder `targetId` (null for the root): the move dialog's rules. */
export function dropIssue(tree: ExcelTree, item: DragItem, targetId: string | null): TreeIssue | null {
  return item.kind === 'folder' ? moveFolderIssue(tree.folders, item.id, targetId) : moveWorkbookIssue(tree, item.id, targetId)
}

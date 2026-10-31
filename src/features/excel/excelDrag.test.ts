import { describe, expect, it } from 'bun:test'
import type { ExcelFolder } from './excelModel'
import { dragKind, dropIssue, ITEM_DRAG_TYPE } from './excelDrag'

function folder(id: string, parentId: string | null): ExcelFolder {
  return { id, organizationId: 'o1', parentId, name: id, createdBy: 'u1', createdAt: 1, updatedAt: 1 }
}

const tree = {
  folders: [folder('a', null), folder('b', 'a'), folder('c', null)],
  workbooks: [{ id: 'w', name: 'w.xlsx', folderId: 'a', dirty: false }],
}

describe('dragKind', () => {
  it('tells a file from the computer from a dragged library row', () => {
    expect(dragKind(['Files'])).toBe('files')
    expect(dragKind([ITEM_DRAG_TYPE, 'text/plain'])).toBe('item')
    expect(dragKind(['text/plain'])).toBeNull()
  })
})

describe('dropIssue', () => {
  it('allows dropping a workbook or a folder on another folder or the root', () => {
    expect(dropIssue(tree, { kind: 'workbook', id: 'w' }, 'c')).toBeNull()
    expect(dropIssue(tree, { kind: 'workbook', id: 'w' }, null)).toBeNull()
    expect(dropIssue(tree, { kind: 'folder', id: 'c' }, 'b')).toBeNull()
  })

  it('refuses the same rules as the move dialog', () => {
    expect(dropIssue(tree, { kind: 'workbook', id: 'w' }, 'a')).toBe('sameLocation')
    expect(dropIssue(tree, { kind: 'folder', id: 'a' }, 'b')).toBe('cycle')
    expect(dropIssue(tree, { kind: 'folder', id: 'a' }, 'a')).toBe('cycle')
  })
})

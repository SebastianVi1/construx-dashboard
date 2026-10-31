import { describe, expect, it } from 'bun:test'
import type { ExcelFolder, TreeWorkbook } from './excelModel'
import {
  createFolderIssue,
  deleteSummary,
  folderContents,
  folderHref,
  folderPath,
  MAX_FOLDER_NAME,
  MAX_FOLDERS,
  moveFolderIssue,
  moveWorkbookIssue,
  newFolderIssue,
  renameFolderIssue,
} from './excelTree'

function folder(id: string, parentId: string | null, name = id): ExcelFolder {
  return { id, organizationId: 'o1', parentId, name, createdBy: 'u1', createdAt: 1, updatedAt: 1 }
}

function workbook(id: string, folderId: string | null, dirty = false, name = `${id}.xlsx`): TreeWorkbook {
  return { id, folderId, name, dirty }
}

// finance (1) > year (2) > q1 (3); works (1)
const folders = [folder('finance', null, 'Finance'), folder('year', 'finance', '2026'), folder('q1', 'year', 'Q1'), folder('works', null, 'Works')]
const workbooks = [workbook('a', 'finance'), workbook('b', 'q1', true), workbook('c', null), workbook('d', 'year', true)]
const tree = { folders, workbooks }

describe('folderHref', () => {
  it('links the root and a folder', () => {
    expect(folderHref(null)).toBe('/excel')
    expect(folderHref('a b')).toBe('/excel/folders/a%20b')
  })
})

describe('folderPath', () => {
  it('lists the folders from the root down to the given one', () => {
    expect(folderPath(folders, 'q1').map((item) => item.id)).toEqual(['finance', 'year', 'q1'])
    expect(folderPath(folders, null)).toEqual([])
    expect(folderPath(folders, 'missing')).toEqual([])
  })
})

describe('folderContents', () => {
  it('returns the direct sub-folders and workbooks sorted by name', () => {
    const extra = { folders: [...folders, folder('admin', null, 'admin')], workbooks: [...workbooks, workbook('z', null, false, 'A.xlsx')] }
    const contents = folderContents(extra, null)
    expect(contents.folders.map((item) => item.id)).toEqual(['admin', 'finance', 'works'])
    expect(contents.workbooks.map((item) => item.id)).toEqual(['z', 'c'])
    expect(contents.counts.get('finance')).toEqual({ folders: 1, workbooks: 1 })
    expect(contents.counts.get('works')).toEqual({ folders: 0, workbooks: 0 })
  })
})

describe('createFolderIssue', () => {
  it('accepts a trimmed new name up to three levels deep', () => {
    expect(createFolderIssue(tree, null, '  Suppliers ')).toBeNull()
    expect(createFolderIssue(tree, 'year', 'Q2')).toBeNull()
  })

  it('rejects a fourth level', () => {
    expect(createFolderIssue(tree, 'q1', 'January')).toBe('tooDeep')
  })

  it('rejects empty, too long and taken names, ignoring case and spaces', () => {
    expect(createFolderIssue(tree, null, '   ')).toBe('nameInvalid')
    expect(createFolderIssue(tree, null, 'x'.repeat(MAX_FOLDER_NAME + 1))).toBe('nameInvalid')
    expect(createFolderIssue(tree, null, 'x'.repeat(MAX_FOLDER_NAME))).toBeNull()
    expect(createFolderIssue(tree, null, ' finance ')).toBe('nameTaken')
    expect(createFolderIssue(tree, 'finance', 'Finance')).toBeNull()
  })

  it('rejects a missing parent and a full library', () => {
    expect(createFolderIssue(tree, 'missing', 'X')).toBe('notFound')
    const full = { folders: Array.from({ length: MAX_FOLDERS }, (_, i) => folder(`f${i}`, null)), workbooks: [] }
    expect(createFolderIssue(full, null, 'X')).toBe('folderLimit')
  })
})

describe('newFolderIssue', () => {
  it('says whether a folder can be created before a name is typed', () => {
    expect(newFolderIssue(tree, 'year')).toBeNull()
    expect(newFolderIssue(tree, 'q1')).toBe('tooDeep')
    expect(newFolderIssue(tree, 'missing')).toBe('notFound')
  })
})

describe('renameFolderIssue', () => {
  it('allows keeping or recasing its own name but not a sibling name', () => {
    expect(renameFolderIssue(folders, 'finance', 'FINANCE')).toBeNull()
    expect(renameFolderIssue(folders, 'finance', 'works')).toBe('nameTaken')
    expect(renameFolderIssue(folders, 'finance', '')).toBe('nameInvalid')
    expect(renameFolderIssue(folders, 'missing', 'X')).toBe('notFound')
  })
})

describe('moveFolderIssue', () => {
  it('moves a folder when depth and names allow it', () => {
    expect(moveFolderIssue(folders, 'q1', null)).toBeNull()
    expect(moveFolderIssue(folders, 'works', 'year')).toBeNull()
  })

  it('rejects moving into itself or a descendant', () => {
    expect(moveFolderIssue(folders, 'finance', 'finance')).toBe('cycle')
    expect(moveFolderIssue(folders, 'finance', 'q1')).toBe('cycle')
  })

  it('rejects a move that would go past three levels, counting its sub-folders', () => {
    expect(moveFolderIssue(folders, 'finance', 'works')).toBe('tooDeep')
    expect(moveFolderIssue(folders, 'year', 'works')).toBeNull()
    expect(moveFolderIssue(folders, 'works', 'q1')).toBe('tooDeep')
  })

  it('rejects the current location, a taken name and missing folders', () => {
    expect(moveFolderIssue(folders, 'year', 'finance')).toBe('sameLocation')
    expect(moveFolderIssue([...folders, folder('other', 'works', 'q1')], 'other', 'year')).toBe('nameTaken')
    expect(moveFolderIssue(folders, 'missing', null)).toBe('notFound')
    expect(moveFolderIssue(folders, 'year', 'missing')).toBe('notFound')
  })
})

describe('moveWorkbookIssue', () => {
  it('moves a workbook to another folder or the root', () => {
    expect(moveWorkbookIssue(tree, 'a', 'works')).toBeNull()
    expect(moveWorkbookIssue(tree, 'a', null)).toBeNull()
  })

  it('rejects the current location and missing items', () => {
    expect(moveWorkbookIssue(tree, 'a', 'finance')).toBe('sameLocation')
    expect(moveWorkbookIssue(tree, 'c', null)).toBe('sameLocation')
    expect(moveWorkbookIssue(tree, 'missing', null)).toBe('notFound')
    expect(moveWorkbookIssue(tree, 'a', 'missing')).toBe('notFound')
  })
})

describe('deleteSummary', () => {
  it('counts everything under a folder, including itself', () => {
    const summary = deleteSummary(tree, 'finance')
    expect(summary.folderIds.sort()).toEqual(['finance', 'q1', 'year'])
    expect(summary.workbookIds.sort()).toEqual(['a', 'b', 'd'])
    expect(summary.subfolders).toBe(2)
    expect(summary.unexported).toBe(2)
  })

  it('is empty for a missing folder', () => {
    expect(deleteSummary(tree, 'missing')).toEqual({ folderIds: [], workbookIds: [], subfolders: 0, unexported: 0 })
  })
})

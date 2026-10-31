import { describe, expect, it } from 'bun:test'
import type { ExcelFolder, TreeWorkbook } from './excelModel'
import { parseExpanded, toggleExpanded, treeRows } from './excelTreeRows'

function folder(id: string, parentId: string | null, name = id): ExcelFolder {
  return { id, organizationId: 'o1', parentId, name, createdBy: 'u1', createdAt: 1, updatedAt: 1 }
}

function workbook(id: string, folderId: string | null): TreeWorkbook {
  return { id, name: `${id}.xlsx`, folderId, dirty: false }
}

// finance > year > q1 ; works (empty)
const tree = {
  folders: [folder('finance', null, 'Finance'), folder('year', 'finance', '2026'), folder('q1', 'year', 'Q1'), folder('works', null, 'Works')],
  workbooks: [workbook('budget', 'finance'), workbook('root', null), workbook('plan', 'q1')],
}

function shape(rows: ReturnType<typeof treeRows>) {
  return rows.map((row) =>
    row.kind === 'folder'
      ? `${row.level}:${row.folder.id}${row.expanded ? '-' : '+'}${row.hasChildren ? '' : '(empty)'}`
      : `${row.level}:${row.workbook.id}`,
  )
}

describe('treeRows', () => {
  it('lists collapsed folders before workbooks', () => {
    expect(shape(treeRows(tree, null, new Set()))).toEqual(['0:finance+', '0:works+(empty)', '0:root'])
  })

  it('shows the content of expanded folders right under them, one level deeper', () => {
    const rows = treeRows(tree, null, new Set(['finance', 'year']))
    expect(shape(rows)).toEqual(['0:finance-', '1:year-', '2:q1+', '1:budget', '0:works+(empty)', '0:root'])
  })

  it('hides the content of an expanded folder whose parent is collapsed', () => {
    expect(shape(treeRows(tree, null, new Set(['year'])))).toEqual(['0:finance+', '0:works+(empty)', '0:root'])
  })

  it('starts from a given folder', () => {
    expect(shape(treeRows(tree, 'year', new Set(['q1'])))).toEqual(['0:q1-', '1:plan'])
  })
})

describe('toggleExpanded', () => {
  it('opens a closed folder and closes an open one without changing the input', () => {
    const start = new Set(['a'])
    expect([...toggleExpanded(start, 'b')].sort()).toEqual(['a', 'b'])
    expect([...toggleExpanded(start, 'a')]).toEqual([])
    expect([...start]).toEqual(['a'])
  })
})

describe('parseExpanded', () => {
  it('reads a stored list and ignores anything else', () => {
    expect([...parseExpanded('["a","b"]')]).toEqual(['a', 'b'])
    expect([...parseExpanded('["a",3]')]).toEqual(['a'])
    expect([...parseExpanded(null)]).toEqual([])
    expect([...parseExpanded('not json')]).toEqual([])
    expect([...parseExpanded('{"a":1}')]).toEqual([])
  })
})

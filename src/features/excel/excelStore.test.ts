import { describe, expect, it } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import type { ExcelFolder, ExcelRecord } from './excelModel'
import { ExcelTreeError, openExcelStore, toStoreError } from './excelStore'

const org = 'o1'

function record(id: string, updatedAt: number, overrides: Partial<ExcelRecord> = {}): ExcelRecord {
  return {
    id,
    organizationId: org,
    folderId: null,
    createdBy: 'u1',
    name: `${id}.xlsx`,
    size: 3,
    sheetCount: 1,
    original: new Uint8Array([1, 2, 3]).buffer,
    ops: [{ kind: 'setCell', sheet: 0, row: 0, col: 0, value: 'x' }],
    dirty: false,
    createdAt: 1,
    updatedAt,
    exportedAt: null,
    ...overrides,
  }
}

function folder(id: string, parentId: string | null, overrides: Partial<ExcelFolder> = {}): ExcelFolder {
  return { id, organizationId: org, parentId, name: id, createdBy: 'u1', createdAt: 1, updatedAt: 1, ...overrides }
}

async function treeIssue(action: Promise<unknown>): Promise<string> {
  try {
    await action
  } catch (error) {
    if (error instanceof ExcelTreeError) return error.issue
    throw error
  }
  return 'none'
}

/** A version 1 database as the first release of the library left it, with one workbook. */
async function versionOneDatabase(): Promise<IDBFactory> {
  const factory = new IDBFactory()
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = factory.open('construx-excel', 1)
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore('workbooks', { keyPath: 'id' }).createIndex('owner', ['userId', 'organizationId'])
      opening.result.createObjectStore('originals')
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error)
  })
  const legacy: Partial<ExcelRecord> & { userId: string } = { ...record('old', 5), userId: 'u9' }
  delete legacy.original
  delete legacy.folderId
  delete legacy.createdBy
  const transaction = db.transaction(['workbooks', 'originals'], 'readwrite')
  transaction.objectStore('workbooks').put(legacy)
  transaction.objectStore('originals').put(new Uint8Array([7]).buffer, 'old')
  await new Promise((resolve) => (transaction.oncomplete = resolve))
  db.close()
  return factory
}

describe('openExcelStore', () => {
  it('puts, gets and lists the workbooks of an organization', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.put(record('b', 20, { createdBy: 'u2' }))
    const { workbooks } = await store.tree(org)
    expect(workbooks.map((item) => item.id)).toEqual(['b', 'a'])
    expect(workbooks[0]).not.toHaveProperty('original')
    expect(workbooks[0]).not.toHaveProperty('ops')
    const found = await store.get(org, 'a')
    expect(found?.ops).toEqual(record('a', 10).ops)
    expect(new Uint8Array(found!.original)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await store.count(org)).toBe(2)
  })

  it('keeps organizations apart', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.createFolder(folder('f', null))
    expect(await store.tree('o2')).toEqual({ folders: [], workbooks: [] })
    expect(await store.count('o2')).toBe(0)
    expect(await store.get('o2', 'a')).toBeNull()
    await store.remove('o2', 'a')
    expect(await treeIssue(store.deleteFolder('o2', 'f'))).toBe('notFound')
    expect(await store.count(org)).toBe(1)
    expect((await store.tree(org)).folders).toHaveLength(1)
  })

  it('removes a record and its bytes', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.remove(org, 'a')
    expect(await store.count(org)).toBe(0)
    expect(await store.get(org, 'a')).toBeNull()
  })
})

describe('migration from version 1', () => {
  it('moves existing workbooks to the root of their organization without losing them', async () => {
    const store = await openExcelStore(await versionOneDatabase())
    const { workbooks, folders } = await store.tree(org)
    expect(folders).toEqual([])
    expect(workbooks).toHaveLength(1)
    expect(workbooks[0]).toMatchObject({ id: 'old', folderId: null, createdBy: 'u9', updatedAt: 5 })
    expect(workbooks[0]).not.toHaveProperty('userId')
    const found = await store.get(org, 'old')
    expect(found?.ops).toEqual(record('old', 5).ops)
    expect(new Uint8Array(found!.original)).toEqual(new Uint8Array([7]))
  })
})

describe('folders', () => {
  it('creates folders and stores the trimmed name', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.createFolder(folder('f', null, { name: '  Finance ' }))
    expect((await store.tree(org)).folders[0].name).toBe('Finance')
  })

  it('refuses rule violations checked against the stored folders', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.createFolder(folder('a', null, { name: 'A' }))
    await store.createFolder(folder('b', 'a'))
    await store.createFolder(folder('c', 'b'))
    expect(await treeIssue(store.createFolder(folder('x', null, { name: 'a' })))).toBe('nameTaken')
    expect(await treeIssue(store.createFolder(folder('d', 'c')))).toBe('tooDeep')
    expect(await treeIssue(store.moveFolder(org, 'a', 'c', 2))).toBe('cycle')
    expect(await treeIssue(store.renameFolder(org, 'missing', 'Y', 2))).toBe('notFound')
  })

  it('renames and moves folders and workbooks', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.createFolder(folder('a', null))
    await store.createFolder(folder('b', null))
    await store.put(record('w', 10))
    await store.renameFolder(org, 'a', ' Works ', 7)
    await store.moveFolder(org, 'b', 'a', 8)
    await store.moveWorkbook(org, 'w', 'b')
    const { folders, workbooks } = await store.tree(org)
    expect(folders.find((item) => item.id === 'a')).toMatchObject({ name: 'Works', updatedAt: 7 })
    expect(folders.find((item) => item.id === 'b')).toMatchObject({ parentId: 'a', updatedAt: 8 })
    expect(workbooks[0]).toMatchObject({ folderId: 'b', updatedAt: 10 })
    expect(await treeIssue(store.moveWorkbook(org, 'w', 'missing'))).toBe('notFound')
  })

  it('deletes a folder with everything under it and reports what it removed', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.createFolder(folder('a', null))
    await store.createFolder(folder('b', 'a'))
    await store.createFolder(folder('keep', null))
    await store.put(record('in-a', 10, { folderId: 'a' }))
    await store.put(record('in-b', 10, { folderId: 'b', dirty: true }))
    await store.put(record('root', 10))
    const removed = await store.deleteFolder(org, 'a')
    expect(removed.folderIds.sort()).toEqual(['a', 'b'])
    expect(removed.workbookIds.sort()).toEqual(['in-a', 'in-b'])
    expect(removed.unexported).toBe(1)
    const { folders, workbooks } = await store.tree(org)
    expect(folders.map((item) => item.id)).toEqual(['keep'])
    expect(workbooks.map((item) => item.id)).toEqual(['root'])
    expect(await store.get(org, 'in-b')).toBeNull()
  })
})

describe('saveEdits', () => {
  it('updates the edit log without rewriting the original bytes', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.saveEdits(record('a', 30, { original: new Uint8Array([9]).buffer, ops: [], dirty: true }))
    const found = await store.get(org, 'a')
    expect(found?.ops).toEqual([])
    expect(found?.dirty).toBe(true)
    expect(found?.updatedAt).toBe(30)
    expect(new Uint8Array(found!.original)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('keeps the folder the workbook was moved to while it was open', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.createFolder(folder('f', null))
    await store.put(record('a', 10))
    await store.moveWorkbook(org, 'a', 'f')
    await store.saveEdits(record('a', 30, { ops: [] }))
    expect((await store.get(org, 'a'))?.folderId).toBe('f')
  })

  it('does not save edits for a record of another organization', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.saveEdits(record('a', 30, { organizationId: 'o2', ops: [] }))
    expect((await store.get(org, 'a'))?.ops).toEqual(record('a', 10).ops)
  })
})

describe('toStoreError', () => {
  it('maps a quota error', () => {
    expect(toStoreError(new DOMException('full', 'QuotaExceededError')).reason).toBe('quota')
    expect(toStoreError(new Error('blocked')).reason).toBe('unavailable')
  })
})

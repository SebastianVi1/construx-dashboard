import { describe, expect, it } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import type { ExcelRecord } from './excelModel'
import { openExcelStore, toStoreError } from './excelStore'

const owner = { userId: 'u1', organizationId: 'o1' }

function record(id: string, updatedAt: number, overrides: Partial<ExcelRecord> = {}): ExcelRecord {
  return {
    id,
    ...owner,
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

describe('openExcelStore', () => {
  it('puts, gets and lists records for one owner', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.put(record('b', 20))
    const list = await store.list(owner)
    expect(list.map((item) => item.id)).toEqual(['b', 'a'])
    expect(list[0]).not.toHaveProperty('original')
    expect(list[0]).not.toHaveProperty('ops')
    const found = await store.get(owner, 'a')
    expect(found?.ops).toEqual(record('a', 10).ops)
    expect(new Uint8Array(found!.original)).toEqual(new Uint8Array([1, 2, 3]))
    expect(await store.count(owner)).toBe(2)
  })

  it('keeps owners apart', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    const other = { userId: 'u1', organizationId: 'o2' }
    expect(await store.list(other)).toEqual([])
    expect(await store.count(other)).toBe(0)
    expect(await store.get(other, 'a')).toBeNull()
    await store.remove(other, 'a')
    expect(await store.count(owner)).toBe(1)
  })

  it('removes a record and its bytes', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.remove(owner, 'a')
    expect(await store.count(owner)).toBe(0)
    expect(await store.get(owner, 'a')).toBeNull()
  })
})

describe('saveEdits', () => {
  it('updates the edit log without rewriting the original bytes', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.saveEdits(record('a', 30, { original: new Uint8Array([9]).buffer, ops: [], dirty: true }))
    const found = await store.get(owner, 'a')
    expect(found?.ops).toEqual([])
    expect(found?.dirty).toBe(true)
    expect(found?.updatedAt).toBe(30)
    expect(new Uint8Array(found!.original)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('does not save edits for a record of another owner', async () => {
    const store = await openExcelStore(new IDBFactory())
    await store.put(record('a', 10))
    await store.saveEdits(record('a', 30, { organizationId: 'o2', ops: [] }))
    expect((await store.get(owner, 'a'))?.ops).toEqual(record('a', 10).ops)
  })
})

describe('toStoreError', () => {
  it('maps a quota error', () => {
    expect(toStoreError(new DOMException('full', 'QuotaExceededError')).reason).toBe('quota')
    expect(toStoreError(new Error('blocked')).reason).toBe('unavailable')
  })
})

import type { ExcelRecord, ExcelRecordSummary } from './excelModel'

export type Owner = { userId: string; organizationId: string }

/** `quota`: the browser ran out of storage for the site; `unavailable`: storage is blocked or failed. */
export class ExcelStoreError extends Error {
  readonly reason: 'quota' | 'unavailable'

  constructor(reason: 'quota' | 'unavailable', message = `Excel store: ${reason}`) {
    super(message)
    this.reason = reason
  }
}

export function toStoreError(error: unknown): ExcelStoreError {
  if (error instanceof ExcelStoreError) return error
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  return new ExcelStoreError(name === 'QuotaExceededError' ? 'quota' : 'unavailable', String(error))
}

export type ExcelStore = {
  /** Newest edit first. */
  list(owner: Owner): Promise<ExcelRecordSummary[]>
  /** Null when missing or owned by another user or organization. */
  get(owner: Owner, id: string): Promise<ExcelRecord | null>
  put(record: ExcelRecord): Promise<void>
  /** Saves the edit log and flags without rewriting the original bytes; ignored for another owner. */
  saveEdits(record: ExcelRecord): Promise<void>
  remove(owner: Owner, id: string): Promise<void>
  count(owner: Owner): Promise<number>
}

const DB_NAME = 'construx-excel'
const WORKBOOKS = 'workbooks'
const ORIGINALS = 'originals'

/** Stored without the file bytes, so listing never loads them. */
type StoredWorkbook = ExcelRecordSummary & { ops: ExcelRecord['ops'] }

export async function openExcelStore(factory: IDBFactory = globalThis.indexedDB): Promise<ExcelStore> {
  const db = await open(factory)
  const ownerKey = (owner: Owner) => [owner.userId, owner.organizationId]

  return {
    async list(owner) {
      const rows = await request<StoredWorkbook[]>(
        db.transaction(WORKBOOKS).objectStore(WORKBOOKS).index('owner').getAll(ownerKey(owner)),
      )
      return rows.map(toSummary).sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async get(owner, id) {
      const transaction = db.transaction([WORKBOOKS, ORIGINALS])
      const [workbook, original] = await Promise.all([
        request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(id)),
        request<ArrayBuffer | undefined>(transaction.objectStore(ORIGINALS).get(id)),
      ])
      if (!workbook || !original || !isOwner(workbook, owner)) return null
      return { ...workbook, original }
    },

    async put(record) {
      const { original, ...workbook } = record
      const transaction = db.transaction([WORKBOOKS, ORIGINALS], 'readwrite')
      transaction.objectStore(WORKBOOKS).put(workbook)
      transaction.objectStore(ORIGINALS).put(original, record.id)
      await done(transaction)
    },

    async saveEdits(record) {
      const workbook: Partial<ExcelRecord> = { ...record }
      delete workbook.original
      const transaction = db.transaction(WORKBOOKS, 'readwrite')
      const stored = await request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(record.id))
      if (stored && isOwner(stored, record)) transaction.objectStore(WORKBOOKS).put(workbook)
      await done(transaction)
    },

    async remove(owner, id) {
      const transaction = db.transaction([WORKBOOKS, ORIGINALS], 'readwrite')
      const workbook = await request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(id))
      if (workbook && isOwner(workbook, owner)) {
        transaction.objectStore(WORKBOOKS).delete(id)
        transaction.objectStore(ORIGINALS).delete(id)
      }
      await done(transaction)
    },

    count(owner) {
      return request<number>(db.transaction(WORKBOOKS).objectStore(WORKBOOKS).index('owner').count(ownerKey(owner)))
    },
  }
}

function toSummary(workbook: StoredWorkbook): ExcelRecordSummary {
  const summary: Partial<StoredWorkbook> = { ...workbook }
  delete summary.ops
  return summary as ExcelRecordSummary
}

function isOwner(workbook: StoredWorkbook, owner: Owner): boolean {
  return workbook.userId === owner.userId && workbook.organizationId === owner.organizationId
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let opening: IDBOpenDBRequest
    try {
      opening = factory.open(DB_NAME, 1)
    } catch (error) {
      reject(toStoreError(error))
      return
    }
    opening.onupgradeneeded = () => {
      const db = opening.result
      db.createObjectStore(WORKBOOKS, { keyPath: 'id' }).createIndex('owner', ['userId', 'organizationId'])
      db.createObjectStore(ORIGINALS)
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(toStoreError(opening.error))
    opening.onblocked = () => reject(new ExcelStoreError('unavailable', 'Excel store blocked'))
  })
}

function request<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(toStoreError(req.error))
  })
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(toStoreError(transaction.error))
    transaction.onabort = () => reject(toStoreError(transaction.error))
  })
}

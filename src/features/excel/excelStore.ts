import type { ExcelFolder, ExcelLibrary, ExcelRecord, ExcelRecordSummary } from './excelModel'
import type { DeleteSummary, TreeIssue } from './excelTree'
import {
  createFolderIssue,
  deleteSummary,
  folderName,
  moveFolderIssue,
  moveWorkbookIssue,
  renameFolderIssue,
} from './excelTree'

/** `quota`: the browser ran out of storage for the site; `unavailable`: storage is blocked or failed. */
export class ExcelStoreError extends Error {
  readonly reason: 'quota' | 'unavailable'

  constructor(reason: 'quota' | 'unavailable', message = `Excel store: ${reason}`) {
    super(message)
    this.reason = reason
  }
}

/** A folder change the rules in `excelTree.ts` refuse, checked against what is stored. */
export class ExcelTreeError extends Error {
  readonly issue: TreeIssue

  constructor(issue: TreeIssue) {
    super(`Excel folders: ${issue}`)
    this.issue = issue
  }
}

export function toStoreError(error: unknown): ExcelStoreError {
  if (error instanceof ExcelStoreError) return error
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  return new ExcelStoreError(name === 'QuotaExceededError' ? 'quota' : 'unavailable', String(error))
}

/**
 * The storage port of the Excel library. Everything belongs to an organization; a record of
 * another organization reads as missing. This browser adapter will be joined by an S3 one.
 */
export type ExcelStore = {
  tree(organizationId: string): Promise<ExcelLibrary>
  /** Null when missing or owned by another organization. */
  get(organizationId: string, id: string): Promise<ExcelRecord | null>
  put(record: ExcelRecord): Promise<void>
  /** Saves the edit log and flags only, so a move made while the workbook was open is kept. */
  saveEdits(record: ExcelRecord): Promise<void>
  remove(organizationId: string, id: string): Promise<void>
  count(organizationId: string): Promise<number>
  /** The folder rules throw `ExcelTreeError`; names are stored trimmed. */
  createFolder(folder: ExcelFolder): Promise<void>
  renameFolder(organizationId: string, folderId: string, name: string, now: number): Promise<void>
  moveFolder(organizationId: string, folderId: string, targetId: string | null, now: number): Promise<void>
  moveWorkbook(organizationId: string, workbookId: string, targetId: string | null): Promise<void>
  /** Removes the folder and everything under it in one transaction. */
  deleteFolder(organizationId: string, folderId: string): Promise<DeleteSummary>
}

const DB_NAME = 'construx-excel'
const DB_VERSION = 2
const WORKBOOKS = 'workbooks'
const ORIGINALS = 'originals'
const FOLDERS = 'folders'
const BY_ORGANIZATION = 'organization'

/** Stored without the file bytes, so listing never loads them. */
type StoredWorkbook = ExcelRecordSummary & { ops: ExcelRecord['ops'] }

export async function openExcelStore(factory: IDBFactory = globalThis.indexedDB): Promise<ExcelStore> {
  const db = await open(factory)

  /** Reads the organization's folders and workbooks inside `transaction`, so a write can check them. */
  async function load(transaction: IDBTransaction, organizationId: string): Promise<ExcelLibrary> {
    const [folders, workbooks] = await Promise.all([
      request<ExcelFolder[]>(transaction.objectStore(FOLDERS).index(BY_ORGANIZATION).getAll(organizationId)),
      request<StoredWorkbook[]>(transaction.objectStore(WORKBOOKS).index(BY_ORGANIZATION).getAll(organizationId)),
    ])
    return { folders, workbooks: workbooks.map(toSummary) }
  }

  function write(stores: string[]) {
    return db.transaction(stores, 'readwrite')
  }

  return {
    async tree(organizationId) {
      const library = await load(db.transaction([FOLDERS, WORKBOOKS]), organizationId)
      return { ...library, workbooks: library.workbooks.sort((a, b) => b.updatedAt - a.updatedAt) }
    },

    async get(organizationId, id) {
      const transaction = db.transaction([WORKBOOKS, ORIGINALS])
      const [workbook, original] = await Promise.all([
        request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(id)),
        request<ArrayBuffer | undefined>(transaction.objectStore(ORIGINALS).get(id)),
      ])
      if (!workbook || !original || workbook.organizationId !== organizationId) return null
      return { ...workbook, original }
    },

    async put(record) {
      const { original, ...workbook } = record
      const transaction = write([WORKBOOKS, ORIGINALS])
      transaction.objectStore(WORKBOOKS).put(workbook)
      transaction.objectStore(ORIGINALS).put(original, record.id)
      await done(transaction)
    },

    async saveEdits(record) {
      const transaction = write([WORKBOOKS])
      const stored = await request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(record.id))
      if (stored && stored.organizationId === record.organizationId) {
        const { ops, dirty, updatedAt, exportedAt } = record
        transaction.objectStore(WORKBOOKS).put({ ...stored, ops, dirty, updatedAt, exportedAt })
      }
      await done(transaction)
    },

    async remove(organizationId, id) {
      const transaction = write([WORKBOOKS, ORIGINALS])
      const workbook = await request<StoredWorkbook | undefined>(transaction.objectStore(WORKBOOKS).get(id))
      if (workbook && workbook.organizationId === organizationId) {
        transaction.objectStore(WORKBOOKS).delete(id)
        transaction.objectStore(ORIGINALS).delete(id)
      }
      await done(transaction)
    },

    count(organizationId) {
      return request<number>(db.transaction(WORKBOOKS).objectStore(WORKBOOKS).index(BY_ORGANIZATION).count(organizationId))
    },

    async createFolder(folder) {
      const transaction = write([FOLDERS, WORKBOOKS])
      const library = await load(transaction, folder.organizationId)
      refuse(transaction, createFolderIssue(library, folder.parentId, folder.name))
      transaction.objectStore(FOLDERS).put({ ...folder, name: folderName(folder.name) })
      await done(transaction)
    },

    async renameFolder(organizationId, folderId, name, now) {
      const transaction = write([FOLDERS, WORKBOOKS])
      const { folders } = await load(transaction, organizationId)
      refuse(transaction, renameFolderIssue(folders, folderId, name))
      const folder = folders.find((item) => item.id === folderId)!
      transaction.objectStore(FOLDERS).put({ ...folder, name: folderName(name), updatedAt: now })
      await done(transaction)
    },

    async moveFolder(organizationId, folderId, targetId, now) {
      const transaction = write([FOLDERS, WORKBOOKS])
      const { folders } = await load(transaction, organizationId)
      refuse(transaction, moveFolderIssue(folders, folderId, targetId))
      const folder = folders.find((item) => item.id === folderId)!
      transaction.objectStore(FOLDERS).put({ ...folder, parentId: targetId, updatedAt: now })
      await done(transaction)
    },

    async moveWorkbook(organizationId, workbookId, targetId) {
      const transaction = write([FOLDERS, WORKBOOKS])
      const library = await load(transaction, organizationId)
      refuse(transaction, moveWorkbookIssue(library, workbookId, targetId))
      const stored = await request<StoredWorkbook>(transaction.objectStore(WORKBOOKS).get(workbookId))
      transaction.objectStore(WORKBOOKS).put({ ...stored, folderId: targetId })
      await done(transaction)
    },

    async deleteFolder(organizationId, folderId) {
      const transaction = write([FOLDERS, WORKBOOKS, ORIGINALS])
      const library = await load(transaction, organizationId)
      const summary = deleteSummary(library, folderId)
      refuse(transaction, summary.folderIds.length === 0 ? 'notFound' : null)
      for (const id of summary.folderIds) transaction.objectStore(FOLDERS).delete(id)
      for (const id of summary.workbookIds) {
        transaction.objectStore(WORKBOOKS).delete(id)
        transaction.objectStore(ORIGINALS).delete(id)
      }
      await done(transaction)
      return summary
    },
  }
}

/** Aborts the write and throws when a folder rule refuses it. */
function refuse(transaction: IDBTransaction, issue: TreeIssue | null) {
  if (!issue) return
  transaction.abort()
  throw new ExcelTreeError(issue)
}

function toSummary(workbook: StoredWorkbook): ExcelRecordSummary {
  const summary: Partial<StoredWorkbook> = { ...workbook }
  delete summary.ops
  return summary as ExcelRecordSummary
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let opening: IDBOpenDBRequest
    try {
      opening = factory.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(toStoreError(error))
      return
    }
    opening.onupgradeneeded = (event) => upgrade(opening.result, opening.transaction!, event.oldVersion)
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(toStoreError(opening.error))
    opening.onblocked = () => reject(new ExcelStoreError('unavailable', 'Excel store blocked'))
  })
}

/**
 * Version 1 kept workbooks per user and organization; version 2 shares them with the
 * organization and adds folders. Existing workbooks move to the root, keeping their uploader.
 * A failure aborts the upgrade transaction, leaving version 1 untouched.
 */
function upgrade(db: IDBDatabase, transaction: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore(WORKBOOKS, { keyPath: 'id' })
    db.createObjectStore(ORIGINALS)
  }
  if (oldVersion < 2) {
    const workbooks = transaction.objectStore(WORKBOOKS)
    if (workbooks.indexNames.contains('owner')) workbooks.deleteIndex('owner')
    workbooks.createIndex(BY_ORGANIZATION, 'organizationId')
    db.createObjectStore(FOLDERS, { keyPath: 'id' }).createIndex(BY_ORGANIZATION, 'organizationId')
    const cursor = workbooks.openCursor()
    cursor.onsuccess = () => {
      const row = cursor.result
      if (!row) return
      const { userId, ...workbook } = row.value as StoredWorkbook & { userId?: string }
      row.update({ ...workbook, folderId: workbook.folderId ?? null, createdBy: workbook.createdBy ?? userId ?? '' })
      row.continue()
    }
  }
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

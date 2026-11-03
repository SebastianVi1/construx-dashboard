import type { SiteReport } from './reportApi'

const DB_NAME = 'construx-reports'
const DB_VERSION = 1
const REPORTS = 'reports'
const BLOBS = 'blobs'
const BY_SITE = 'siteId'

type StoredReport = SiteReport & { siteId: string }

/** Opens the reports IndexedDB. Throws when storage is unavailable or blocked. */
function openDb(factory: IDBFactory = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = factory.open(DB_NAME, DB_VERSION)
    } catch {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      const reports = db.createObjectStore(REPORTS, { keyPath: 'id' })
      reports.createIndex(BY_SITE, 'siteId')
      db.createObjectStore(BLOBS)
    }
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close()
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** Saves one report's metadata to the cache. Silently no-ops if storage fails. */
export async function cacheReport(siteId: string, report: SiteReport): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(REPORTS, 'readwrite')
    await req(tx.objectStore(REPORTS).put({ ...report, siteId }))
  } catch {
    // cache is best-effort
  }
}

/** Saves multiple reports at once, replacing any existing entries for the same site. */
export async function cacheReports(siteId: string, reports: SiteReport[]): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(REPORTS, 'readwrite')
    const store = tx.objectStore(REPORTS)
    for (const r of reports) {
      store.put({ ...r, siteId })
    }
  } catch {
    // cache is best-effort
  }
}

/** Returns cached reports for a site, sorted newest first. Returns [] on any failure. */
export async function listCachedReports(siteId: string): Promise<SiteReport[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(REPORTS, 'readonly')
    const rows = await req<StoredReport[]>(
      tx.objectStore(REPORTS).index(BY_SITE).getAll(siteId),
    )
    return rows
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row): SiteReport => ({
        id: row.id, title: row.title, status: row.status,
        generatedByName: row.generatedByName, createdAt: row.createdAt,
        completedAt: row.completedAt, sizeBytes: row.sizeBytes,
      }))
  } catch {
    return []
  }
}

/** Caches a PDF blob by report ID. Silently no-ops on failure. */
export async function savePdfBlob(reportId: string, blob: Blob): Promise<void> {
  try {
    const ab = await blob.arrayBuffer()
    const db = await openDb()
    const tx = db.transaction(BLOBS, 'readwrite')
    await req(tx.objectStore(BLOBS).put(ab, reportId))
  } catch {
    // cache is best-effort
  }
}

/** Returns the cached PDF blob for a report, or null if not cached. */
export async function getPdfBlob(reportId: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    const tx = db.transaction(BLOBS, 'readonly')
    const ab = await req<ArrayBuffer | undefined>(tx.objectStore(BLOBS).get(reportId))
    return ab ? new Blob([ab], { type: 'application/pdf' }) : null
  } catch {
    return null
  }
}

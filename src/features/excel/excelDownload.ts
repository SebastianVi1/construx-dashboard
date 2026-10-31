import { XLSX_MIME } from './excelFile'
import type { ExcelRecord } from './excelModel'
import { exportInWorker } from './excelWorkerClient'

/**
 * Builds the edited `.xlsx` in the worker and saves it under the original name. Stores nothing:
 * the caller records the download with `exportedRecord`, through the editor's save queue when
 * one is open, so a save from an edit made meanwhile is never overwritten.
 */
export async function downloadWorkbook(record: ExcelRecord): Promise<void> {
  const bytes = await exportInWorker(record.original, record.ops)
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = record.name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start reading the blob after `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The record after a download of its first `exportedOps` edits; later edits keep it dirty. */
export function exportedRecord(current: ExcelRecord, exportedOps: number, now = Date.now()): ExcelRecord {
  return { ...current, dirty: current.ops.length !== exportedOps, exportedAt: now }
}

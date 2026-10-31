import { XLSX_MIME } from './excelFile'
import type { ExcelRecord } from './excelModel'
import type { ExcelStore } from './excelStore'
import { exportInWorker } from './excelWorkerClient'

/**
 * Builds the edited `.xlsx` in the worker, saves it under the original name, and marks the
 * record exported. Returns the updated record; the original bytes are never changed.
 */
export async function downloadWorkbook(store: ExcelStore, record: ExcelRecord): Promise<ExcelRecord> {
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
  const exported = { ...record, dirty: false, exportedAt: Date.now() }
  await store.put(exported)
  return exported
}

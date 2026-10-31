import type { ExcelRecord } from './excelModel'
import type { ExcelStoreError } from './excelStore'
import { toStoreError } from './excelStore'

export type SaveState = 'idle' | 'pending' | 'saving' | 'error'

export type SaveQueue = {
  push(record: ExcelRecord): void
  flush(): Promise<void>
  hasUnsaved(): boolean
}

/**
 * Debounces saves of the edited workbook and keeps only the newest version. A failed save
 * keeps that version in memory and reports `error`; the next push or flush retries it,
 * so an edit is never silently lost.
 */
export function createSaveQueue(options: {
  save: (record: ExcelRecord) => Promise<void>
  /** Runs `run` later and returns a cancel function; the editor passes a 500 ms timeout. */
  schedule: (run: () => void) => () => void
  onState: (state: SaveState, error?: ExcelStoreError) => void
}): SaveQueue {
  let latest: ExcelRecord | null = null
  let cancel: (() => void) | null = null
  let running: Promise<void> | null = null
  let unsaved = false

  async function drain() {
    while (latest) {
      const record = latest
      latest = null
      options.onState('saving')
      try {
        await options.save(record)
      } catch (error) {
        latest ??= record
        options.onState('error', toStoreError(error))
        return
      }
    }
    unsaved = false
    options.onState('idle')
  }

  async function flush() {
    cancel?.()
    cancel = null
    if (running) await running
    if (!latest) return
    running = drain()
    try {
      await running
    } finally {
      running = null
    }
  }

  return {
    push(record) {
      latest = record
      unsaved = true
      cancel?.()
      cancel = options.schedule(() => void flush())
      options.onState('pending')
    },
    flush,
    hasUnsaved: () => unsaved,
  }
}

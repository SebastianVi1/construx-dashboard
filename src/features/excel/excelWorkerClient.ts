import type { ExcelOp, GridSheet } from './excelModel'
import type { ExcelRequest, ExcelResponse } from './excelWorkerProtocol'

export class ExcelWorkerError extends Error {
  readonly reason: 'unreadable' | 'failed'

  constructor(reason: 'unreadable' | 'failed') {
    super(`Excel worker: ${reason}`)
    this.reason = reason
  }
}

type Outgoing = { kind: 'parse'; buffer: ArrayBuffer } | { kind: 'export'; buffer: ArrayBuffer; ops: ExcelOp[] }

type Pending = { resolve: (response: ExcelResponse) => void; reject: (error: ExcelWorkerError) => void }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<ExcelResponse>) => {
    const request = pending.get(event.data.id)
    pending.delete(event.data.id)
    request?.resolve(event.data)
  }
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new ExcelWorkerError('failed'))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

/** Sends a copy of the bytes, so the caller's buffer is never detached by the transfer. */
function send(request: Outgoing): Promise<ExcelResponse> {
  const id = nextId++
  const buffer = request.buffer.slice(0)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const message: ExcelRequest = { ...request, id, buffer }
    getWorker().postMessage(message, [buffer])
  })
}

export async function parseInWorker(buffer: ArrayBuffer): Promise<GridSheet[]> {
  const response = await send({ kind: 'parse', buffer })
  if (!response.ok) throw new ExcelWorkerError(response.error)
  if (response.kind !== 'parse') throw new ExcelWorkerError('failed')
  return response.sheets
}

export async function exportInWorker(buffer: ArrayBuffer, ops: ExcelOp[]): Promise<ArrayBuffer> {
  const response = await send({ kind: 'export', buffer, ops })
  if (!response.ok) throw new ExcelWorkerError(response.error)
  if (response.kind !== 'export') throw new ExcelWorkerError('failed')
  return response.buffer
}

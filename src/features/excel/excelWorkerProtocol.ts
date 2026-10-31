import type { ExcelOp, GridSheet } from './excelModel'
import { exportWorkbook } from './excelExport'
import { ExcelParseError, parseWorkbook } from './excelParse'

export type ExcelRequest =
  | { id: number; kind: 'parse'; buffer: ArrayBuffer }
  | { id: number; kind: 'export'; buffer: ArrayBuffer; ops: ExcelOp[] }

export type ExcelResponse =
  | { id: number; ok: true; kind: 'parse'; sheets: GridSheet[] }
  | { id: number; ok: true; kind: 'export'; buffer: ArrayBuffer }
  | { id: number; ok: false; error: 'unreadable' | 'failed' }

/** The worker's whole job; kept apart from the worker global so it can be tested. */
export async function handleExcelRequest(request: ExcelRequest): Promise<ExcelResponse> {
  try {
    if (request.kind === 'parse') {
      return { id: request.id, ok: true, kind: 'parse', sheets: await parseWorkbook(request.buffer) }
    }
    return { id: request.id, ok: true, kind: 'export', buffer: await exportWorkbook(request.buffer, request.ops) }
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof ExcelParseError ? 'unreadable' : 'failed' }
  }
}

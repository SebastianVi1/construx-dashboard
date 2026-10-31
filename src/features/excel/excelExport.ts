import ExcelJS from 'exceljs'
import type { ExcelOp } from './excelModel'
import { loadWorkbook } from './excelLoad'
import { applyOps } from './excelOps'
import { sheetsFromWorkbook } from './excelParse'

const DEFAULT_COL_WIDTH = 64

/**
 * Replays the edit log on the original workbook, so styles, number formats and formulas the
 * grid never touched survive. ExcelJS does not move merges or column widths when rows and
 * columns are spliced, so those are reconciled from `applyOps`, the same model the grid shows.
 */
export async function exportWorkbook(original: ArrayBuffer, ops: ExcelOp[]): Promise<ArrayBuffer> {
  const workbook = await loadWorkbook(original)
  const expected = applyOps(sheetsFromWorkbook(workbook), ops)
  const worksheets = workbook.worksheets

  // Without merges, a write to a cell lands on that cell and not on a stale merge's master.
  for (const worksheet of worksheets) {
    for (const range of worksheet.model.merges ?? []) worksheet.unMergeCells(range)
  }

  for (const op of ops) {
    const worksheet = worksheets[op.sheet]
    if (!worksheet) continue
    switch (op.kind) {
      case 'setCell': {
        const cell = worksheet.getCell(op.row + 1, op.col + 1)
        if (cell.type !== ExcelJS.ValueType.Formula) cell.value = op.value
        break
      }
      case 'insertRows':
        worksheet.spliceRows(op.at + 1, 0, ...Array.from({ length: op.count }, () => []))
        break
      case 'removeRows':
        worksheet.spliceRows(op.at + 1, op.count)
        break
      case 'insertCols':
        worksheet.spliceColumns(op.at + 1, 0, ...Array.from({ length: op.count }, () => []))
        break
      case 'removeCols':
        worksheet.spliceColumns(op.at + 1, op.count)
        break
    }
  }

  worksheets.forEach((worksheet, index) => {
    const sheet = expected[index]
    for (const merge of sheet.merges) {
      worksheet.mergeCells(merge.row + 1, merge.col + 1, merge.row + merge.rowspan, merge.col + merge.colspan)
    }
    sheet.colWidths.forEach((px, col) => {
      worksheet.getColumn(col + 1).width = px === DEFAULT_COL_WIDTH ? undefined : (px - 5) / 7
    })
  })

  // Edited inputs make cached formula results stale; Excel and LibreOffice recalculate on open.
  workbook.calcProperties.fullCalcOnLoad = true
  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}

/** ExcelJS hands back a Node `Buffer` outside the browser; copy it into a standalone `ArrayBuffer`. */
export function toArrayBuffer(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

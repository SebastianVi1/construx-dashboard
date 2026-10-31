import ExcelJS from 'exceljs'
import type { CellValue, GridCell, GridSheet, Merge } from './excelModel'
import { emptyCell } from './excelModel'

/** The bytes are not a workbook ExcelJS can open (corrupt, encrypted, or another format renamed). */
export class ExcelParseError extends Error {}

/** Excel stores widths in characters; Handsontable wants pixels. 64 px is Excel's default column. */
export function colWidthPx(chars: number | undefined): number {
  return chars === undefined ? 64 : Math.round(chars * 7 + 5)
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<GridSheet[]> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch (error) {
    throw new ExcelParseError(error instanceof Error ? error.message : String(error))
  }
  // Any zip opens; one without worksheets (a renamed .docx, for example) is not a workbook.
  if (workbook.worksheets.length === 0) throw new ExcelParseError('No worksheets')
  return sheetsFromWorkbook(workbook)
}

export function sheetsFromWorkbook(workbook: ExcelJS.Workbook): GridSheet[] {
  return workbook.worksheets.map(sheetFromWorksheet)
}

function sheetFromWorksheet(worksheet: ExcelJS.Worksheet): GridSheet {
  const merges = (worksheet.model.merges ?? []).map(decodeRange)
  const rows = Math.max(worksheet.rowCount, ...merges.map((merge) => merge.row + merge.rowspan))
  const cols = Math.max(worksheet.columnCount, ...merges.map((merge) => merge.col + merge.colspan))
  const cells: GridCell[][] = []
  for (let row = 0; row < rows; row++) {
    const line: GridCell[] = []
    for (let col = 0; col < cols; col++) line.push(gridCell(worksheet.getCell(row + 1, col + 1)))
    cells.push(line)
  }
  const colWidths = Array.from({ length: cols }, (_, col) => colWidthPx(worksheet.getColumn(col + 1).width))
  return { name: worksheet.name, cells, merges, colWidths }
}

function gridCell(cell: ExcelJS.Cell): GridCell {
  const numFmt = cell.numFmt || null
  switch (cell.type) {
    case ExcelJS.ValueType.Number:
      return { value: cell.value as number, type: 'number', numFmt, readOnly: false }
    case ExcelJS.ValueType.Date:
      return { value: cell.value as Date, type: 'date', numFmt, readOnly: false }
    case ExcelJS.ValueType.Boolean:
      return { value: cell.value as boolean, type: 'boolean', numFmt, readOnly: false }
    case ExcelJS.ValueType.String:
    case ExcelJS.ValueType.SharedString:
    case ExcelJS.ValueType.RichText:
    case ExcelJS.ValueType.Hyperlink:
    case ExcelJS.ValueType.Error:
      return { value: cell.text, type: 'text', numFmt, readOnly: false }
    case ExcelJS.ValueType.Formula:
      return { value: formulaResult(cell.result), type: 'formula', numFmt, formula: cell.formula, readOnly: true }
    default:
      return emptyCell
  }
}

function formulaResult(result: ExcelJS.CellValue | undefined): CellValue {
  if (result === undefined || result === null) return null
  if (typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean' || result instanceof Date) {
    return result
  }
  if (typeof result === 'object' && 'error' in result) return String(result.error)
  return String(result)
}

/** `'A6:B6'` → `{ row: 5, col: 0, rowspan: 1, colspan: 2 }`. */
function decodeRange(range: string): Merge {
  const [start, end = start] = range.split(':').map(decodeAddress)
  return { row: start.row, col: start.col, rowspan: end.row - start.row + 1, colspan: end.col - start.col + 1 }
}

function decodeAddress(address: string): { row: number; col: number } {
  const match = /^\$?([A-Z]+)\$?(\d+)$/.exec(address.toUpperCase())
  if (!match) throw new ExcelParseError(`Invalid cell address ${address}`)
  let col = 0
  for (const letter of match[1]) col = col * 26 + (letter.charCodeAt(0) - 64)
  return { row: Number(match[2]) - 1, col: col - 1 }
}

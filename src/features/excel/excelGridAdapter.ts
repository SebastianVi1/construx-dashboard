import type { CellValue, ExcelOp, GridCell, GridSheet } from './excelModel'

/** What Handsontable holds in its data array; dates are ISO `YYYY-MM-DD` strings. */
export type HotValue = string | number | boolean | null

/** Handsontable's `afterChange` entry: row, column, old value, new value. */
export type HotChange = [row: number, col: number | string, oldValue: unknown, newValue: unknown]

const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/
const numeric = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i

/** Dates use UTC getters: ExcelJS dates are UTC midnights, and local time would shift a day west of UTC. */
export function toGridData(sheet: GridSheet): HotValue[][] {
  return sheet.cells.map((row) => row.map((cell) => (cell.value instanceof Date ? isoDayOf(cell.value) : cell.value)))
}

function isoDayOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Turns what the editor produced back into a cell value, keeping the cell's type when the input fits it. */
export function coerceCellValue(cell: GridCell, raw: unknown): CellValue {
  if (raw === '' || raw === null || raw === undefined) return null
  if (typeof raw === 'boolean') return raw
  if (cell.type === 'number') {
    const number = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(number) ? number : String(raw)
  }
  if (cell.type === 'date') {
    const match = isoDay.exec(String(raw))
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : String(raw)
  }
  // Like Excel's General format: figures typed into a blank or text cell are numbers, unless
  // the cell is formatted as text (`@`).
  if (typeof raw === 'number') return raw
  if ((cell.type === 'empty' || cell.type === 'text') && cell.numFmt !== '@' && numeric.test(String(raw))) {
    return Number(raw)
  }
  return String(raw)
}

export function opsFromChanges(sheet: GridSheet, sheetIndex: number, changes: HotChange[] | null, source: string): ExcelOp[] {
  if (!changes || source === 'loadData') return []
  return changes
    .filter(([, , oldValue, newValue]) => oldValue !== newValue)
    .map(([row, col, , newValue]) => {
      const column = Number(col)
      const cell = sheet.cells[row]?.[column] ?? { value: null, type: 'empty', numFmt: null, readOnly: false }
      return { kind: 'setCell', sheet: sheetIndex, row, col: column, value: coerceCellValue(cell, newValue) }
    })
}

export function opsFromStructure(
  kind: 'insertRows' | 'removeRows' | 'insertCols' | 'removeCols',
  sheetIndex: number,
  at: number,
  count: number,
): ExcelOp[] {
  return [{ kind, sheet: sheetIndex, at, count }]
}

/** The per-cell settings Handsontable needs: editor and renderer type, read-only, and locale formatting. */
export type CellMeta = {
  type: 'numeric' | 'date' | 'checkbox' | 'text'
  readOnly: boolean
  locale?: string
  numericFormat?: Intl.NumberFormatOptions
  dateFormat?: Intl.DateTimeFormatOptions
}

/** `tableReadOnly` wins: Handsontable lets a cell's own `readOnly` override the table's. */
export function cellMeta(cell: GridCell, locale: string, tableReadOnly = false): CellMeta {
  const readOnly = tableReadOnly || cell.readOnly
  const type = cell.type === 'formula' ? resultType(cell.value) : cell.type
  if (type === 'number') return { type: 'numeric', readOnly, locale, numericFormat: numericFormatFor(cell.numFmt) }
  if (type === 'date') return { type: 'date', readOnly, locale, dateFormat: { year: 'numeric', month: '2-digit', day: '2-digit' } }
  if (type === 'boolean') return { type: 'checkbox', readOnly }
  return { type: 'text', readOnly }
}

function resultType(value: CellValue): GridCell['type'] {
  if (typeof value === 'number') return 'number'
  if (value instanceof Date) return 'date'
  if (typeof value === 'boolean') return 'boolean'
  return 'text'
}

/** Reads decimals, grouping and percent from an Excel number format such as `#,##0.00` or `0.0%`. */
function numericFormatFor(numFmt: string | null): Intl.NumberFormatOptions {
  if (!numFmt || numFmt === 'General') return { maximumFractionDigits: 10, useGrouping: false }
  // Only the positive section counts; quoted text and [color]/[locale] tags are not digits.
  const pattern = numFmt.split(';')[0].replace(/"[^"]*"|\[[^\]]*\]/g, '')
  const decimals = /\.([0#]+)/.exec(pattern)?.[1] ?? ''
  const minimum = decimals.replace(/#/g, '').length
  return {
    ...(pattern.includes('%') ? { style: 'percent' as const } : {}),
    minimumFractionDigits: minimum,
    maximumFractionDigits: decimals.length,
    useGrouping: pattern.includes(','),
  }
}

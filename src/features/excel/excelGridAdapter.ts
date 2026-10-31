import type { CellValue, ExcelOp, GridCell, GridSheet } from './excelModel'

/** What Handsontable holds in its data array; dates are ISO `YYYY-MM-DD` strings. */
export type HotValue = string | number | boolean | null

/** Handsontable's `afterChange` entry: row, column, old value, new value. */
export type HotChange = [row: number, col: number | string, oldValue: unknown, newValue: unknown]

const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/

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

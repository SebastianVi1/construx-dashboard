import type { CellType, CellValue, ExcelOp, GridSheet, Merge } from './excelModel'
import { emptyCell } from './excelModel'

const DEFAULT_COL_WIDTH = 64

export function cellTypeOf(value: CellValue): CellType {
  if (value === null) return 'empty'
  if (value instanceof Date) return 'date'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'text'
}

/**
 * Replays the edit log on the parsed sheets. The grid shows its result and the export
 * reconciles merges and widths from it, so the two can't diverge. Never mutates its input.
 */
export function applyOps(sheets: GridSheet[], ops: ExcelOp[]): GridSheet[] {
  const result = sheets.map(copySheet)
  for (const op of ops) {
    const sheet = result[op.sheet]
    if (!sheet) continue
    switch (op.kind) {
      case 'setCell':
        setCell(sheet, op.row, op.col, op.value)
        break
      case 'insertRows':
        sheet.cells.splice(op.at, 0, ...Array.from({ length: op.count }, () => emptyRow(width(sheet))))
        sheet.merges = shiftMerges(sheet.merges, 'row', op.at, op.count)
        break
      case 'removeRows':
        sheet.cells.splice(op.at, op.count)
        sheet.merges = shiftMerges(sheet.merges, 'row', op.at, -op.count)
        break
      case 'insertCols':
        for (const row of sheet.cells) row.splice(op.at, 0, ...emptyRow(op.count))
        sheet.colWidths.splice(op.at, 0, ...Array<number>(op.count).fill(DEFAULT_COL_WIDTH))
        sheet.merges = shiftMerges(sheet.merges, 'col', op.at, op.count)
        break
      case 'removeCols':
        for (const row of sheet.cells) row.splice(op.at, op.count)
        sheet.colWidths.splice(op.at, op.count)
        sheet.merges = shiftMerges(sheet.merges, 'col', op.at, -op.count)
        break
    }
  }
  return result
}

function copySheet(sheet: GridSheet): GridSheet {
  return {
    name: sheet.name,
    cells: sheet.cells.map((row) => [...row]),
    merges: sheet.merges.map((merge) => ({ ...merge })),
    colWidths: [...sheet.colWidths],
  }
}

function width(sheet: GridSheet): number {
  return sheet.colWidths.length
}

function emptyRow(length: number) {
  return Array.from({ length }, () => emptyCell)
}

function setCell(sheet: GridSheet, row: number, col: number, value: CellValue) {
  if (sheet.cells[row]?.[col]?.readOnly) return
  if (col >= width(sheet)) {
    const extra = col + 1 - width(sheet)
    for (const line of sheet.cells) line.push(...emptyRow(extra))
    sheet.colWidths.push(...Array<number>(extra).fill(DEFAULT_COL_WIDTH))
  }
  while (sheet.cells.length <= row) sheet.cells.push(emptyRow(width(sheet)))
  const cell = sheet.cells[row][col]
  sheet.cells[row][col] = { value, type: cellTypeOf(value), numFmt: cell.numFmt, readOnly: false }
}

/**
 * Moves merges for an insertion (`delta > 0`) or removal (`delta < 0`) at `at` on one axis.
 * Merges after the change shift, merges spanning it grow or shrink, and merges left empty
 * or reduced to a single cell are dropped.
 */
function shiftMerges(merges: Merge[], axis: 'row' | 'col', at: number, delta: number): Merge[] {
  const span = axis === 'row' ? 'rowspan' : 'colspan'
  const moved: Merge[] = []
  for (const merge of merges) {
    let start = merge[axis]
    let end = start + merge[span]
    if (delta > 0) {
      if (start >= at) start += delta
      if (end > at) end += delta
    } else {
      const removedEnd = at - delta
      start = start < at ? start : start >= removedEnd ? start + delta : at
      end = end <= at ? end : end >= removedEnd ? end + delta : at
    }
    const next = { ...merge, [axis]: start, [span]: end - start }
    if (next.rowspan > 0 && next.colspan > 0 && next.rowspan * next.colspan > 1) moved.push(next)
  }
  return moved
}

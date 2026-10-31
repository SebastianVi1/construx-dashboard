/** How a cell is shown and edited; `formula` cells show their cached result and are read-only. */
export type CellType = 'number' | 'date' | 'text' | 'boolean' | 'formula' | 'empty'

/** Dates are UTC midnights, as ExcelJS reads them. */
export type CellValue = string | number | boolean | Date | null

export type GridCell = { value: CellValue; type: CellType; numFmt: string | null; formula?: string; readOnly: boolean }

/** 0-based, like every row and column in the grid model. */
export type Merge = { row: number; col: number; rowspan: number; colspan: number }

/** One worksheet as the grid shows it; `colWidths` are pixels. */
export type GridSheet = { name: string; cells: GridCell[][]; merges: Merge[]; colWidths: number[] }

/** One edit, in the order the user made it. Rows and columns are 0-based. */
export type ExcelOp =
  | { kind: 'setCell'; sheet: number; row: number; col: number; value: CellValue }
  | { kind: 'insertRows' | 'removeRows' | 'insertCols' | 'removeCols'; sheet: number; at: number; count: number }

/** The stored workbook: the original bytes plus the edits made since upload are the source of truth. */
export type ExcelRecord = {
  id: string
  userId: string
  organizationId: string
  name: string
  size: number
  sheetCount: number
  original: ArrayBuffer
  ops: ExcelOp[]
  /** Edited since the last download. */
  dirty: boolean
  createdAt: number
  updatedAt: number
  exportedAt: number | null
}

export type ExcelRecordSummary = Omit<ExcelRecord, 'original' | 'ops'>

export const emptyCell: GridCell = { value: null, type: 'empty', numFmt: null, readOnly: false }

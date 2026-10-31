import { HotTable, type HotTableRef } from '@handsontable/react-wrapper'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/styles/ht-theme-main.min.css'
import { memo, useEffect, useRef, type RefObject } from 'react'
import type { ExcelOp, GridSheet } from './excelModel'
import { emptyCell } from './excelModel'
import { applyOps } from './excelOps'
import type { CellMeta, HotChange } from './excelGridAdapter'
import { cellMeta, opsFromChanges, opsFromStructure, toGridData } from './excelGridAdapter'
import './handsontable-theme.css'

registerAllModules()

const licenseKey = (import.meta.env.VITE_HANDSONTABLE_LICENSE as string | undefined) || 'non-commercial-and-evaluation'

const contextMenu = ['row_above', 'row_below', 'remove_row', '---------', 'col_left', 'col_right', 'remove_col'] as const

type ExcelGridProps = {
  /** The sheet as it was when this grid mounted; mount a new grid (a new `key`) to show another sheet. */
  sheet: GridSheet
  sheetIndex: number
  readOnly: boolean
  locale: string
  onOps: (ops: ExcelOp[]) => void
}

/**
 * Handsontable owns the data while it is mounted: edits flow out as ops and are never fed back
 * in, so the grid keeps its scroll and selection. A local copy of the model, updated with the
 * same `applyOps`, tells `cells()` each cell's current type and read-only state.
 *
 * `HotTable` lives in `FrozenTable`, which never re-renders: the wrapper re-sends every prop to
 * `updateSettings` on each render, which would reset merges and widths to their first values.
 * Read-only and locale changes go through the instance and refs instead.
 */
export function ExcelGrid({ sheet, sheetIndex, readOnly, locale, onOps }: ExcelGridProps) {
  const model = useRef(sheet)
  const onOpsRef = useRef(onOps)
  const localeRef = useRef(locale)
  const readOnlyRef = useRef(readOnly)
  const hotRef = useRef<HotTableRef>(null)

  useEffect(() => {
    onOpsRef.current = onOps
  })

  useEffect(() => {
    readOnlyRef.current = readOnly
    localeRef.current = locale
    const hot = hotRef.current?.hotInstance
    if (!hot) return
    hot.updateSettings({ contextMenu: readOnly ? false : [...contextMenu] })
    hot.render()
  }, [readOnly, locale])

  function emit(ops: ExcelOp[]) {
    if (ops.length === 0) return
    model.current = applyOps([model.current], ops.map((op) => ({ ...op, sheet: 0 })))[0]
    onOpsRef.current(ops)
  }

  const handlers: Handlers = {
    cells: (row, col) => cellMeta(model.current.cells[row]?.[col] ?? emptyCell, localeRef.current, readOnlyRef.current),
    change: (changes, source) => emit(opsFromChanges(model.current, sheetIndex, changes, source)),
    structure: (kind, index, amount) => emit(opsFromStructure(kind, sheetIndex, index, amount)),
  }

  return <FrozenTable sheet={sheet} readOnly={readOnly} hotRef={hotRef} handlers={handlers} />
}

type Handlers = {
  cells: (row: number, col: number) => CellMeta
  change: (changes: HotChange[] | null, source: string) => void
  structure: (kind: 'insertRows' | 'removeRows' | 'insertCols' | 'removeCols', index: number, amount: number) => void
}

type FrozenTableProps = { sheet: GridSheet; readOnly: boolean; hotRef: RefObject<HotTableRef | null>; handlers: Handlers }

/** Renders once per mount; the handlers it keeps read the latest state through refs. */
const FrozenTable = memo(
  function FrozenTable({ sheet, readOnly, hotRef, handlers }: FrozenTableProps) {
    return (
      <HotTable
        ref={hotRef}
        themeName="ht-theme-main"
        licenseKey={licenseKey}
        data={toGridData(sheet)}
        rowHeaders
        colHeaders
        colWidths={[...sheet.colWidths]}
        mergeCells={sheet.merges.map((merge) => ({ ...merge }))}
        manualColumnResize
        contextMenu={readOnly ? false : [...contextMenu]}
        autoWrapRow
        autoWrapCol
        width="100%"
        height="100%"
        cells={handlers.cells}
        afterChange={(changes, source) => handlers.change(changes as HotChange[] | null, source)}
        afterCreateRow={(index, amount) => handlers.structure('insertRows', index, amount)}
        afterRemoveRow={(index, amount) => handlers.structure('removeRows', index, amount)}
        afterCreateCol={(index, amount) => handlers.structure('insertCols', index, amount)}
        afterRemoveCol={(index, amount) => handlers.structure('removeCols', index, amount)}
      />
    )
  },
  () => true,
)

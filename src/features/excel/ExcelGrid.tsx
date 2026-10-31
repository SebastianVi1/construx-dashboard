import { HotTable, type HotTableRef } from '@handsontable/react-wrapper'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/styles/ht-theme-main.min.css'
import { useEffect, useRef, useState } from 'react'
import type { ExcelOp, GridSheet } from './excelModel'
import { emptyCell } from './excelModel'
import { applyOps } from './excelOps'
import type { HotChange } from './excelGridAdapter'
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
 * Every `HotTable` prop stays fixed for the grid's lifetime: the wrapper re-sends all props to
 * `updateSettings` on re-render, which would reload the data and reset merges and widths to
 * their first values. Read-only and locale changes go through the instance instead.
 */
export function ExcelGrid({ sheet, sheetIndex, readOnly, locale, onOps }: ExcelGridProps) {
  const [data] = useState(() => toGridData(sheet))
  const [merges] = useState(() => sheet.merges.map((merge) => ({ ...merge })))
  const [colWidths] = useState(() => [...sheet.colWidths])
  const [initialReadOnly] = useState(readOnly)
  const model = useRef(sheet)
  const onOpsRef = useRef(onOps)
  const localeRef = useRef(locale)
  const hotRef = useRef<HotTableRef>(null)

  useEffect(() => {
    onOpsRef.current = onOps
  })

  useEffect(() => {
    hotRef.current?.hotInstance?.updateSettings({ readOnly, contextMenu: readOnly ? false : [...contextMenu] })
  }, [readOnly])

  useEffect(() => {
    localeRef.current = locale
    hotRef.current?.hotInstance?.render()
  }, [locale])

  function emit(ops: ExcelOp[]) {
    if (ops.length === 0) return
    model.current = applyOps([model.current], ops.map((op) => ({ ...op, sheet: 0 })))[0]
    onOpsRef.current(ops)
  }

  return (
    <HotTable
      ref={hotRef}
      themeName="ht-theme-main"
      licenseKey={licenseKey}
      data={data}
      rowHeaders
      colHeaders
      colWidths={colWidths}
      mergeCells={merges}
      manualColumnResize
      contextMenu={initialReadOnly ? false : [...contextMenu]}
      readOnly={initialReadOnly}
      autoWrapRow
      autoWrapCol
      width="100%"
      height="100%"
      cells={(row, col) => cellMeta(model.current.cells[row]?.[col] ?? emptyCell, localeRef.current)}
      afterChange={(changes, source) => emit(opsFromChanges(model.current, sheetIndex, changes as HotChange[] | null, source))}
      afterCreateRow={(index, amount) => emit(opsFromStructure('insertRows', sheetIndex, index, amount))}
      afterRemoveRow={(index, amount) => emit(opsFromStructure('removeRows', sheetIndex, index, amount))}
      afterCreateCol={(index, amount) => emit(opsFromStructure('insertCols', sheetIndex, index, amount))}
      afterRemoveCol={(index, amount) => emit(opsFromStructure('removeCols', sheetIndex, index, amount))}
    />
  )
}

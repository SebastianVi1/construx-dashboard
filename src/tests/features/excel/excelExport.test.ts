import { describe, expect, it } from 'bun:test'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import type { ExcelOp } from '../../../features/excel/excelModel'
import { exportWorkbook } from '../../../features/excel/excelExport'
import { parseWorkbook } from '../../../features/excel/excelParse'
import { buildFixture, withoutCellRefs } from '../../support/excelFixture'

async function roundTrip(ops: ExcelOp[]) {
  return parseWorkbook(await exportWorkbook(await buildFixture(), ops))
}

async function reload(ops: ExcelOp[]) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await exportWorkbook(await buildFixture(), ops))
  return workbook
}

describe('exportWorkbook', () => {
  it('replays edits on a workbook whose rows and cells carry no reference', async () => {
    const ops: ExcelOp[] = [{ kind: 'setCell', sheet: 0, row: 2, col: 1, value: 900 }]
    const [budget] = await parseWorkbook(await exportWorkbook(await withoutCellRefs(await buildFixture()), ops))
    expect(budget.cells[2][1]).toMatchObject({ value: 900, type: 'number' })
    expect(budget.cells[3][1]).toMatchObject({ type: 'formula', formula: 'SUM(B2:B3)' })
    expect(budget.merges).toEqual([{ row: 5, col: 0, rowspan: 1, colspan: 2 }])
  })

  it('returns the same content with no ops', async () => {
    expect(await roundTrip([])).toEqual(await parseWorkbook(await buildFixture()))
  })

  it('keeps an edited number with its numFmt', async () => {
    const [budget] = await roundTrip([{ kind: 'setCell', sheet: 0, row: 1, col: 1, value: 999 }])
    expect(budget.cells[1][1]).toMatchObject({ value: 999, type: 'number', numFmt: '#,##0.00' })
  })

  it('keeps an edited date and text', async () => {
    const [budget] = await roundTrip([
      { kind: 'setCell', sheet: 0, row: 1, col: 2, value: new Date(Date.UTC(2026, 5, 1)) },
      { kind: 'setCell', sheet: 0, row: 2, col: 0, value: 'Rebar' },
    ])
    expect(budget.cells[1][2]).toMatchObject({ type: 'date', numFmt: 'yyyy-mm-dd' })
    expect((budget.cells[1][2].value as Date).toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(budget.cells[2][0]).toMatchObject({ value: 'Rebar', type: 'text' })
  })

  it('keeps the untouched formula and asks for recalculation', async () => {
    const ops: ExcelOp[] = [{ kind: 'setCell', sheet: 0, row: 1, col: 1, value: 999 }]
    const [budget] = await roundTrip(ops)
    expect(budget.cells[3][1]).toMatchObject({ type: 'formula', formula: 'SUM(B2:B3)', readOnly: true })
    // ExcelJS writes calcPr but does not read it back, so check the workbook part itself.
    const zip = await JSZip.loadAsync(await exportWorkbook(await buildFixture(), ops))
    expect(await zip.file('xl/workbook.xml')?.async('string')).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/)
  })

  it('never overwrites a formula cell', async () => {
    const [budget] = await roundTrip([{ kind: 'setCell', sheet: 0, row: 3, col: 1, value: 1 }])
    expect(budget.cells[3][1]).toMatchObject({ type: 'formula', formula: 'SUM(B2:B3)' })
  })

  it('keeps cell styles', async () => {
    const workbook = await reload([{ kind: 'setCell', sheet: 0, row: 1, col: 0, value: 'Sand' }])
    expect(workbook.getWorksheet('Budget')?.getCell('A1').font?.bold).toBe(true)
  })

  it('moves merges and widths when rows and columns are inserted above them', async () => {
    const [budget] = await roundTrip([
      { kind: 'insertRows', sheet: 0, at: 0, count: 1 },
      { kind: 'insertCols', sheet: 0, at: 0, count: 1 },
    ])
    expect(budget.merges).toEqual([{ row: 6, col: 1, rowspan: 1, colspan: 2 }])
    expect(budget.cells[6][1].value).toBe('Total')
    expect(budget.colWidths[0]).toBe(64)
    expect(budget.colWidths[1]).toBe(145)
  })

  it('drops a row on removeRows', async () => {
    const [budget] = await roundTrip([{ kind: 'removeRows', sheet: 0, at: 2, count: 1 }])
    expect(budget.cells.map((row) => row[0].value)).not.toContain('Steel')
    expect(budget.cells[2][1]).toMatchObject({ type: 'formula' })
    expect(budget.merges).toEqual([{ row: 4, col: 0, rowspan: 1, colspan: 2 }])
  })

  it('does not touch other sheets', async () => {
    const [, notes] = await roundTrip([{ kind: 'insertRows', sheet: 0, at: 0, count: 2 }])
    expect(notes.cells[0][0].value).toBe('Hello')
  })
})

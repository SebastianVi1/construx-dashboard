import { describe, expect, it } from 'bun:test'
import type { GridCell, GridSheet } from './excelModel'
import { emptyCell } from './excelModel'
import { cellMeta, coerceCellValue, opsFromChanges, opsFromStructure, toGridData } from './excelGridAdapter'

const dateCell: GridCell = { ...emptyCell, type: 'date', numFmt: 'yyyy-mm-dd' }
const numberCell: GridCell = { ...emptyCell, type: 'number', numFmt: '#,##0.00' }

const sheet: GridSheet = {
  name: 'S',
  cells: [
    [{ value: 'a', type: 'text', numFmt: null, readOnly: false }, { value: 1.5, type: 'number', numFmt: null, readOnly: false }],
    [{ value: new Date(Date.UTC(2026, 2, 15)), type: 'date', numFmt: null, readOnly: false }, emptyCell],
    [{ value: true, type: 'boolean', numFmt: null, readOnly: false }, { ...numberCell, value: 7 }],
  ],
  merges: [],
  colWidths: [64, 64],
}

describe('toGridData', () => {
  it('turns dates into ISO day strings', () => {
    expect(toGridData(sheet)).toEqual([
      ['a', 1.5],
      ['2026-03-15', null],
      [true, 7],
    ])
  })
})

describe('coerceCellValue', () => {
  it('keeps the same day on the round trip', () => {
    expect((coerceCellValue(dateCell, '2026-03-15') as Date).toISOString()).toBe('2026-03-15T00:00:00.000Z')
    expect(coerceCellValue(dateCell, 'soon')).toBe('soon')
  })

  it('coerces numbers, empties and bad input', () => {
    expect(coerceCellValue(numberCell, '12.5')).toBe(12.5)
    expect(coerceCellValue(numberCell, 12.5)).toBe(12.5)
    expect(coerceCellValue(numberCell, 'abc')).toBe('abc')
    expect(coerceCellValue(numberCell, '')).toBeNull()
    expect(coerceCellValue(emptyCell, null)).toBeNull()
    expect(coerceCellValue(emptyCell, false)).toBe(false)
    expect(coerceCellValue(emptyCell, 3)).toBe('3')
  })
})

describe('opsFromChanges', () => {
  it('emits one setCell per real change', () => {
    expect(
      opsFromChanges(sheet, 2, [
        [2, 1, 7, '8'],
        [0, 0, 'a', 'a'],
      ], 'edit'),
    ).toEqual([{ kind: 'setCell', sheet: 2, row: 2, col: 1, value: 8 }])
  })

  it('ignores loadData and null changes', () => {
    expect(opsFromChanges(sheet, 0, [[0, 0, 'a', 'b']], 'loadData')).toEqual([])
    expect(opsFromChanges(sheet, 0, null, 'edit')).toEqual([])
  })
})

describe('opsFromStructure', () => {
  it('maps structure hooks to ops', () => {
    expect(opsFromStructure('removeCols', 1, 2, 3)).toEqual([{ kind: 'removeCols', sheet: 1, at: 2, count: 3 }])
  })
})

describe('cellMeta', () => {
  it('formats numbers from their numFmt and the locale', () => {
    expect(cellMeta({ ...numberCell, value: 1 }, 'es-MX')).toEqual({
      type: 'numeric',
      readOnly: false,
      locale: 'es-MX',
      numericFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true },
    })
    expect(cellMeta({ ...numberCell, numFmt: '0' }, 'en-US').numericFormat).toEqual({
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: false,
    })
    expect(cellMeta({ ...numberCell, numFmt: '0.0%' }, 'en-US').numericFormat).toEqual({
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      useGrouping: false,
    })
    expect(cellMeta({ ...numberCell, numFmt: null }, 'en-US').numericFormat).toEqual({ maximumFractionDigits: 10, useGrouping: false })
  })

  it('maps dates, booleans and text', () => {
    expect(cellMeta(dateCell, 'en-US')).toMatchObject({ type: 'date', locale: 'en-US', readOnly: false })
    expect(cellMeta({ ...emptyCell, type: 'boolean', value: true }, 'en-US')).toEqual({ type: 'checkbox', readOnly: false })
    expect(cellMeta(emptyCell, 'en-US')).toEqual({ type: 'text', readOnly: false })
  })

  it('makes formulas read-only and formats a numeric result', () => {
    const formula: GridCell = { value: 2050.5, type: 'formula', numFmt: '#,##0.00', formula: 'SUM(B2:B3)', readOnly: true }
    expect(cellMeta(formula, 'en-US')).toMatchObject({ type: 'numeric', readOnly: true })
    expect(cellMeta({ ...formula, value: 'n/a' }, 'en-US')).toEqual({ type: 'text', readOnly: true })
  })
})

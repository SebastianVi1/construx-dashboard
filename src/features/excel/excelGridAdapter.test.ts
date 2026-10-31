import { describe, expect, it } from 'bun:test'
import type { GridCell, GridSheet } from './excelModel'
import { emptyCell } from './excelModel'
import { coerceCellValue, opsFromChanges, opsFromStructure, toGridData } from './excelGridAdapter'

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

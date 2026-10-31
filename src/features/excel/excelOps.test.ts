import { describe, expect, it } from 'bun:test'
import type { GridCell, GridSheet } from './excelModel'
import { emptyCell } from './excelModel'
import { applyOps } from './excelOps'

const text = (value: string): GridCell => ({ value, type: 'text', numFmt: null, readOnly: false })

/** 3×3 of letters; `a` has a number format, `c` is a formula, rows 1–2 × cols 0–1 are merged. */
function sheet(name = 'S'): GridSheet {
  return {
    name,
    cells: [
      [{ ...text('a'), numFmt: '0.0' }, text('b'), { value: 3, type: 'formula', numFmt: null, formula: '1+2', readOnly: true }],
      [text('d'), text('e'), text('f')],
      [text('g'), text('h'), text('i')],
    ],
    merges: [{ row: 1, col: 0, rowspan: 2, colspan: 2 }],
    colWidths: [10, 20, 30],
  }
}

const values = (grid: GridSheet) => grid.cells.map((row) => row.map((cell) => cell.value))

describe('applyOps', () => {
  it('sets a value and infers its type, keeping numFmt', () => {
    const [result] = applyOps([sheet()], [{ kind: 'setCell', sheet: 0, row: 0, col: 0, value: 42 }])
    expect(result.cells[0][0]).toEqual({ value: 42, type: 'number', numFmt: '0.0', readOnly: false })
    const [dated] = applyOps([sheet()], [{ kind: 'setCell', sheet: 0, row: 1, col: 2, value: new Date(Date.UTC(2026, 0, 1)) }])
    expect(dated.cells[1][2].type).toBe('date')
    const [cleared] = applyOps([sheet()], [{ kind: 'setCell', sheet: 0, row: 1, col: 2, value: null }])
    expect(cleared.cells[1][2]).toMatchObject({ value: null, type: 'empty' })
  })

  it('ignores setCell on a read-only cell', () => {
    const [result] = applyOps([sheet()], [{ kind: 'setCell', sheet: 0, row: 0, col: 2, value: 'x' }])
    expect(result.cells[0][2]).toEqual(sheet().cells[0][2])
  })

  it('extends the grid when setCell is outside it', () => {
    const [result] = applyOps([sheet()], [{ kind: 'setCell', sheet: 0, row: 4, col: 4, value: 'z' }])
    expect(result.cells).toHaveLength(5)
    expect(result.cells.every((row) => row.length === 5)).toBe(true)
    expect(result.cells[4][4]).toMatchObject({ value: 'z', type: 'text' })
    expect(result.cells[3][0]).toEqual(emptyCell)
    expect(result.colWidths).toEqual([10, 20, 30, 64, 64])
  })

  it('inserts rows and shifts or grows merges', () => {
    const [above] = applyOps([sheet()], [{ kind: 'insertRows', sheet: 0, at: 0, count: 1 }])
    expect(values(above)[0]).toEqual([null, null, null])
    expect(values(above)[1]).toEqual(['a', 'b', 3])
    expect(above.merges).toEqual([{ row: 2, col: 0, rowspan: 2, colspan: 2 }])
    const [inside] = applyOps([sheet()], [{ kind: 'insertRows', sheet: 0, at: 2, count: 1 }])
    expect(values(inside)).toHaveLength(4)
    expect(inside.merges).toEqual([{ row: 1, col: 0, rowspan: 3, colspan: 2 }])
  })

  it('removes rows and drops, shifts or shrinks merges', () => {
    const [shrunk] = applyOps([sheet()], [{ kind: 'removeRows', sheet: 0, at: 2, count: 1 }])
    expect(values(shrunk)).toEqual([['a', 'b', 3], ['d', 'e', 'f']])
    expect(shrunk.merges).toEqual([{ row: 1, col: 0, rowspan: 1, colspan: 2 }])
    const [shifted] = applyOps([sheet()], [{ kind: 'removeRows', sheet: 0, at: 0, count: 1 }])
    expect(shifted.merges).toEqual([{ row: 0, col: 0, rowspan: 2, colspan: 2 }])
    const [dropped] = applyOps([sheet()], [{ kind: 'removeRows', sheet: 0, at: 1, count: 2 }])
    expect(values(dropped)).toEqual([['a', 'b', 3]])
    expect(dropped.merges).toEqual([])
  })

  it('drops a merge reduced to a single cell', () => {
    const [result] = applyOps(
      [sheet()],
      [
        { kind: 'removeRows', sheet: 0, at: 2, count: 1 },
        { kind: 'removeCols', sheet: 0, at: 1, count: 1 },
      ],
    )
    expect(result.merges).toEqual([])
  })

  it('inserts and removes columns with their widths', () => {
    const [inserted] = applyOps([sheet()], [{ kind: 'insertCols', sheet: 0, at: 1, count: 1 }])
    expect(values(inserted)[0]).toEqual(['a', null, 'b', 3])
    expect(inserted.colWidths).toEqual([10, 64, 20, 30])
    expect(inserted.merges).toEqual([{ row: 1, col: 0, rowspan: 2, colspan: 3 }])
    const [removed] = applyOps([sheet()], [{ kind: 'removeCols', sheet: 0, at: 0, count: 1 }])
    expect(values(removed)[0]).toEqual(['b', 3])
    expect(removed.colWidths).toEqual([20, 30])
    expect(removed.merges).toEqual([{ row: 1, col: 0, rowspan: 2, colspan: 1 }])
  })

  it('applies ops in order and only to their sheet', () => {
    const [first, second] = applyOps(
      [sheet('A'), sheet('B')],
      [
        { kind: 'setCell', sheet: 0, row: 0, col: 0, value: 'x' },
        { kind: 'insertRows', sheet: 0, at: 0, count: 1 },
        { kind: 'setCell', sheet: 1, row: 0, col: 1, value: 'y' },
      ],
    )
    expect(values(first)[0][0]).toBeNull()
    expect(values(first)[1][0]).toBe('x')
    expect(values(second)[0]).toEqual(['a', 'y', 3])
    expect(second.cells).toHaveLength(3)
  })

  it('does not mutate its input', () => {
    const input = [sheet()]
    const before = structuredClone(input)
    applyOps(input, [
      { kind: 'setCell', sheet: 0, row: 0, col: 0, value: 1 },
      { kind: 'insertRows', sheet: 0, at: 1, count: 2 },
      { kind: 'removeCols', sheet: 0, at: 0, count: 1 },
    ])
    expect(input).toEqual(before)
  })
})

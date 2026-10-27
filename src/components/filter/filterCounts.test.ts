import { describe, expect, test } from 'bun:test'
import { filterCounts } from './filterCounts'

type Row = { id: string; kind: 'a' | 'b' | 'c' }
const rows: Row[] = [
  { id: '1', kind: 'a' },
  { id: '2', kind: 'b' },
  { id: '3', kind: 'a' },
]
const kinds = ['a', 'b', 'c'] as const

describe('filterCounts', () => {
  test('counts every value, including the ones without rows, and keeps all rows without a filter', () => {
    expect(filterCounts(rows, (row) => row.kind, kinds, '')).toEqual({
      counts: { all: 3, a: 2, b: 1, c: 0 },
      visible: rows,
    })
  })

  test('keeps only the rows of the selected value, in their original order', () => {
    expect(filterCounts(rows, (row) => row.kind, kinds, 'a').visible.map((row) => row.id)).toEqual(['1', '3'])
    expect(filterCounts(rows, (row) => row.kind, kinds, 'c').visible).toEqual([])
  })

  test('ignores rows whose value is not listed', () => {
    expect(filterCounts(rows, (row) => row.kind, ['a'] as const, '').counts).toEqual({ all: 3, a: 2 })
  })
})

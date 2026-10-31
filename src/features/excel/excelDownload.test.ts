import { describe, expect, it } from 'bun:test'
import type { ExcelRecord } from './excelModel'
import { exportedRecord } from './excelDownload'

const op = { kind: 'setCell', sheet: 0, row: 0, col: 0, value: 1 } as const
const record = (ops: number) => ({ id: 'a', ops: Array(ops).fill(op), dirty: true, exportedAt: null }) as unknown as ExcelRecord

describe('exportedRecord', () => {
  it('clears dirty when the download holds every edit', () => {
    expect(exportedRecord(record(2), 2, 99)).toMatchObject({ dirty: false, exportedAt: 99 })
  })

  it('stays dirty and keeps edits made while the file was being built', () => {
    const next = exportedRecord(record(3), 2, 99)
    expect(next).toMatchObject({ dirty: true, exportedAt: 99 })
    expect(next.ops).toHaveLength(3)
  })
})

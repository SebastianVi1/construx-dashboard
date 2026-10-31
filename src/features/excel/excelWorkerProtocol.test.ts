import { describe, expect, it } from 'bun:test'
import { handleExcelRequest } from './excelWorkerProtocol'
import { buildFixture } from './testFixture'

describe('handleExcelRequest', () => {
  it('parses a workbook', async () => {
    const response = await handleExcelRequest({ id: 1, kind: 'parse', buffer: await buildFixture() })
    expect(response).toMatchObject({ id: 1, ok: true, kind: 'parse' })
    expect(response.ok && response.kind === 'parse' && response.sheets.length).toBe(2)
  })

  it('reports unreadable bytes', async () => {
    const buffer = new TextEncoder().encode('not a zip').buffer as ArrayBuffer
    expect(await handleExcelRequest({ id: 2, kind: 'parse', buffer })).toEqual({ id: 2, ok: false, error: 'unreadable' })
  })

  it('exports a workbook', async () => {
    const response = await handleExcelRequest({ id: 3, kind: 'export', buffer: await buildFixture(), ops: [] })
    expect(response).toMatchObject({ id: 3, ok: true, kind: 'export' })
    expect(response.ok && response.kind === 'export' && response.buffer.byteLength > 0).toBe(true)
  })
})

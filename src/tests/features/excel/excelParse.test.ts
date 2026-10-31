import { describe, expect, it } from 'bun:test'
import JSZip from 'jszip'
import { ExcelParseError, parseWorkbook } from '../../../features/excel/excelParse'
import { buildFixture, withoutCellRefs } from '../../support/excelFixture'

describe('parseWorkbook', () => {
  it('reads a workbook whose rows and cells carry no reference, as Excel does', async () => {
    const sheets = await parseWorkbook(await withoutCellRefs(await buildFixture()))
    expect(sheets).toEqual(await parseWorkbook(await buildFixture()))
  })

  it('reads every sheet in order', async () => {
    const sheets = await parseWorkbook(await buildFixture())
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Budget', 'Notes'])
  })

  it('infers cell types and keeps numFmt', async () => {
    const [budget] = await parseWorkbook(await buildFixture())
    expect(budget.cells[0][0]).toMatchObject({ value: 'Item', type: 'text', readOnly: false })
    expect(budget.cells[1][1]).toMatchObject({ value: 1250.5, type: 'number', numFmt: '#,##0.00' })
    expect(budget.cells[1][2]).toMatchObject({ type: 'date', numFmt: 'yyyy-mm-dd' })
    expect((budget.cells[1][2].value as Date).toISOString()).toBe('2026-03-15T00:00:00.000Z')
    expect(budget.cells[1][3]).toMatchObject({ value: true, type: 'boolean' })
  })

  it('shows a formula as its cached result, read-only', async () => {
    const [budget] = await parseWorkbook(await buildFixture())
    expect(budget.cells[3][1]).toMatchObject({ value: 2050.5, type: 'formula', formula: 'SUM(B2:B3)', readOnly: true })
  })

  it('reads merges and widths', async () => {
    const [budget] = await parseWorkbook(await buildFixture())
    expect(budget.merges).toEqual([{ row: 5, col: 0, rowspan: 1, colspan: 2 }])
    expect(budget.cells[5][0].value).toBe('Total')
    expect(budget.colWidths[0]).toBe(145)
    expect(budget.colWidths[1]).toBe(64)
  })

  it('rejects bytes that are not a workbook', async () => {
    const bytes = new TextEncoder().encode('not a zip')
    await expect(parseWorkbook(bytes.buffer as ArrayBuffer)).rejects.toBeInstanceOf(ExcelParseError)
  })

  it('rejects a zip that holds no worksheets', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document/>')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(parseWorkbook(buffer)).rejects.toBeInstanceOf(ExcelParseError)
  })
})

import { describe, expect, it } from 'bun:test'
import { excelFileIssue, MAX_EXCEL_BYTES, XLSX_MIME } from '../../../features/excel/excelFile'

const xlsx = { name: 'budget.xlsx', type: XLSX_MIME, size: 1024 }

describe('excelFileIssue', () => {
  it('accepts an xlsx under the limits', () => {
    expect(excelFileIssue(xlsx)).toBeNull()
  })

  it('accepts an xlsx with an empty or generic MIME type', () => {
    expect(excelFileIssue({ ...xlsx, type: '' })).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/octet-stream' })).toBeNull()
    expect(excelFileIssue({ ...xlsx, name: 'BUDGET.XLSX' })).toBeNull()
  })

  it('accepts the types some Windows setups report for an xlsx', () => {
    expect(excelFileIssue({ ...xlsx, type: 'application/vnd.ms-excel' })).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/x-zip-compressed' })).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/zip' })).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'image/png' })).toBe('fileType')
  })

  it('rejects other extensions', () => {
    expect(excelFileIssue({ ...xlsx, name: 'budget.xls' })).toBe('fileType')
    expect(excelFileIssue({ name: 'budget.csv', type: 'text/csv', size: 10 })).toBe('fileType')
  })

  it('rejects an empty file', () => {
    expect(excelFileIssue({ ...xlsx, size: 0 })).toBe('empty')
  })

  it('allows exactly 20 MB and rejects more', () => {
    expect(excelFileIssue({ ...xlsx, size: MAX_EXCEL_BYTES })).toBeNull()
    expect(excelFileIssue({ ...xlsx, size: MAX_EXCEL_BYTES + 1 })).toBe('tooLarge')
  })
})

import { describe, expect, it } from 'bun:test'
import { excelFileIssue, MAX_EXCEL_BYTES, MAX_LIBRARY_FILES, XLSX_MIME } from './excelFile'

const xlsx = { name: 'budget.xlsx', type: XLSX_MIME, size: 1024 }

describe('excelFileIssue', () => {
  it('accepts an xlsx under the limits', () => {
    expect(excelFileIssue(xlsx, 0)).toBeNull()
  })

  it('accepts an xlsx with an empty or generic MIME type', () => {
    expect(excelFileIssue({ ...xlsx, type: '' }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/octet-stream' }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, name: 'BUDGET.XLSX' }, 0)).toBeNull()
  })

  it('accepts the types some Windows setups report for an xlsx', () => {
    expect(excelFileIssue({ ...xlsx, type: 'application/vnd.ms-excel' }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/x-zip-compressed' }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'application/zip' }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, type: 'image/png' }, 0)).toBe('fileType')
  })

  it('rejects other extensions', () => {
    expect(excelFileIssue({ ...xlsx, name: 'budget.xls' }, 0)).toBe('fileType')
    expect(excelFileIssue({ name: 'budget.csv', type: 'text/csv', size: 10 }, 0)).toBe('fileType')
  })

  it('rejects an empty file', () => {
    expect(excelFileIssue({ ...xlsx, size: 0 }, 0)).toBe('empty')
  })

  it('allows exactly 10 MB and rejects more', () => {
    expect(excelFileIssue({ ...xlsx, size: MAX_EXCEL_BYTES }, 0)).toBeNull()
    expect(excelFileIssue({ ...xlsx, size: MAX_EXCEL_BYTES + 1 }, 0)).toBe('tooLarge')
  })

  it('rejects a 201st file but allows replacing when full', () => {
    expect(excelFileIssue(xlsx, MAX_LIBRARY_FILES - 1)).toBeNull()
    expect(excelFileIssue(xlsx, MAX_LIBRARY_FILES)).toBe('libraryFull')
    expect(excelFileIssue(xlsx, MAX_LIBRARY_FILES, true)).toBeNull()
  })
})

export const MAX_EXCEL_BYTES = 10 * 1024 * 1024
/** Workbooks per organization, across every folder. */
export const MAX_LIBRARY_FILES = 200
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Browsers without an office suite report an `.xlsx` with no type or a generic one, and some
 * Windows setups report the old Excel or a zip type. The worker still checks the content.
 */
const acceptedTypes = [
  XLSX_MIME,
  '',
  'application/octet-stream',
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
]

export type ExcelFileIssue = 'fileType' | 'empty' | 'tooLarge' | 'libraryFull'

/** Checked as soon as a file is picked; replacing a file with the same name does not take a new slot. */
export function excelFileIssue(
  file: { name: string; type: string; size: number },
  libraryCount: number,
  replacing = false,
): ExcelFileIssue | null {
  if (!file.name.toLowerCase().endsWith('.xlsx') || !acceptedTypes.includes(file.type)) return 'fileType'
  if (file.size === 0) return 'empty'
  if (file.size > MAX_EXCEL_BYTES) return 'tooLarge'
  if (!replacing && libraryCount >= MAX_LIBRARY_FILES) return 'libraryFull'
  return null
}

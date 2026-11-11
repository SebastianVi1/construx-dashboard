/** Largest document the browser lets through; the backend sets no limit of its own. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

/**
 * PDF, images, Office files and CAD drawings. Checked by extension because CAD files and some
 * Office files often arrive without a MIME type.
 */
export const DOCUMENT_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'dwg',
  'dxf',
] as const

/** The file input's `accept` list. */
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')

export type DocumentFileIssue = 'fileType' | 'tooLarge' | 'empty'

export function documentFileIssue(file: { name: string; size: number }): DocumentFileIssue | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!file.name.includes('.') || !(DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)) return 'fileType'
  if (file.size === 0) return 'empty'
  if (file.size > MAX_DOCUMENT_BYTES) return 'tooLarge'
  return null
}

import { describe, expect, test } from 'bun:test'
import { documentFileIssue, MAX_DOCUMENT_BYTES } from '../../../features/documents/documentFile'

describe('document file', () => {
  test('takes PDF, images, Office and CAD files whatever the case of the extension', () => {
    for (const name of ['contrato.pdf', 'foto.JPG', 'presupuesto.xlsx', 'plano.dwg', 'corte.DXF', 'minuta.docx']) {
      expect(documentFileIssue({ name, size: 1000 })).toBeNull()
    }
  })

  test('rejects other types, empty files and files over 50 MB', () => {
    expect(documentFileIssue({ name: 'setup.exe', size: 1000 })).toBe('fileType')
    expect(documentFileIssue({ name: 'README', size: 1000 })).toBe('fileType')
    expect(documentFileIssue({ name: 'vacio.pdf', size: 0 })).toBe('empty')
    expect(documentFileIssue({ name: 'grande.pdf', size: MAX_DOCUMENT_BYTES + 1 })).toBe('tooLarge')
    expect(documentFileIssue({ name: 'justo.pdf', size: MAX_DOCUMENT_BYTES })).toBeNull()
  })
})

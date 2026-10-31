import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const WORKSHEET = /^xl\/worksheets\/[^/]+\.xml$/
const ROW_OR_CELL = /<(row|c)(?=[\s>/])([^>]*)>/g
const UNNUMBERED = /<(?:row|c)(?=[\s>/])(?![^>]*\sr=")/

/**
 * Opens an `.xlsx` with ExcelJS. The format makes the `r` reference on rows and cells optional
 * and some generators leave it out; ExcelJS rejects those sheets, so the references are filled
 * in first. A workbook that already has them is handed over untouched.
 */
export async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await withCellRefs(buffer))
  return workbook
}

async function withCellRefs(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  let changed = false
  for (const path of Object.keys(zip.files).filter((name) => WORKSHEET.test(name))) {
    const xml = await zip.file(path)!.async('string')
    if (!UNNUMBERED.test(xml)) continue
    zip.file(path, numberRowsAndCells(xml))
    changed = true
  }
  // Stored rather than compressed: ExcelJS unzips it right away.
  return changed ? zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' }) : buffer
}

/** A row without `r` follows the previous row; a cell without `r` follows the previous cell. */
function numberRowsAndCells(xml: string): string {
  let row = 0
  let col = -1
  return xml.replace(ROW_OR_CELL, (tag, name: string, attrs: string) => {
    const ref = /\sr="([A-Z]*)(\d*)"/.exec(attrs)
    if (name === 'row') {
      row = ref ? Number(ref[2]) : row + 1
      col = -1
      return ref ? tag : `<row r="${row}"${attrs}>`
    }
    if (ref) {
      col = columnIndex(ref[1])
      return tag
    }
    col++
    return `<c r="${columnName(col)}${row}"${attrs}>`
  })
}

function columnIndex(letters: string): number {
  let col = 0
  for (const letter of letters) col = col * 26 + (letter.charCodeAt(0) - 64)
  return col - 1
}

function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

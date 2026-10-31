import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { toArrayBuffer } from './excelExport'

/** A small two-sheet workbook with styles, a formula, a merge, a date and numbers. Tests only. */
export async function buildFixture(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const budget = workbook.addWorksheet('Budget')
  budget.getCell('A1').value = 'Item'
  budget.getCell('A1').font = { bold: true }
  budget.getCell('B1').value = 'Cost'
  budget.getCell('A2').value = 'Cement'
  budget.getCell('B2').value = 1250.5
  budget.getCell('B2').numFmt = '#,##0.00'
  budget.getCell('A3').value = 'Steel'
  budget.getCell('B3').value = 800
  budget.getCell('B4').value = { formula: 'SUM(B2:B3)', result: 2050.5 }
  budget.getCell('C2').value = new Date(Date.UTC(2026, 2, 15))
  budget.getCell('C2').numFmt = 'yyyy-mm-dd'
  budget.getCell('D2').value = true
  budget.mergeCells('A6:B6')
  budget.getCell('A6').value = 'Total'
  budget.getColumn(1).width = 20

  const notes = workbook.addWorksheet('Notes')
  notes.getCell('A1').value = 'Hello'

  return toArrayBuffer(await workbook.xlsx.writeBuffer())
}

/**
 * The same workbook as some generators write it: no `r` on rows, and none on a cell that
 * directly follows the previous one (a cell after a gap keeps its reference). Tests only.
 */
export async function withoutCellRefs(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  for (const path of Object.keys(zip.files).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name))) {
    let previous = -1
    const xml = (await zip.file(path)!.async('string')).replace(/<(row|c)(?=[\s>/])([^>]*)>/g, (tag, name: string, attrs: string) => {
      const ref = /\sr="([A-Z]*)\d+"/.exec(attrs)
      if (name === 'row') {
        previous = -1
        return `<row${attrs.replace(/\sr="\d+"/, '')}>`
      }
      if (!ref) return tag
      const col = [...ref[1]].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
      const follows = col === previous + 1
      previous = col
      return follows ? `<c${attrs.replace(ref[0], '')}>` : tag
    })
    zip.file(path, xml)
  }
  return zip.generateAsync({ type: 'arraybuffer' })
}

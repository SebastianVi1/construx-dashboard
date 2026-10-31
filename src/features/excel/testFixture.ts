import ExcelJS from 'exceljs'
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

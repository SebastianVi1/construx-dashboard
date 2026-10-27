import { describe, expect, it } from 'bun:test'
import { messages } from '../../i18n'
import {
  PRICE_IMPORT_HEADER,
  PRICE_IMPORT_TEMPLATE_NAME,
  canConfirmImport,
  importErrorKey,
  importErrorText,
  invalidRowCount,
  previewDate,
  previewPrice,
  priceImportTemplate,
  priceImportTemplateHref,
} from './priceImport'
import type { ImportReport } from './pricingApi'

const contractCodes = [
  'REQUIRED',
  'INVALID',
  'FUTURE_DATE',
  'TOO_MANY_DECIMALS',
  'ARCHIVED_MATERIAL',
  'ARCHIVED_SUPPLIER',
  'COLUMNS',
]

const validReport: ImportReport = {
  valid: true,
  rows: [
    {
      line: 2,
      material: 'Cemento gris 50 kg',
      supplier: 'Home Depot',
      branch: 'Tlalpan',
      price: '245.50',
      observedOn: '2026-10-20',
      newMaterial: false,
      newSupplier: true,
      errors: [],
    },
  ],
  summary: { rows: 1, newMaterials: 0, newSuppliers: 1, observations: 1 },
  imported: false,
}

describe('price import template', () => {
  it('has the exact contract header and one example row, with CRLF line endings', () => {
    const text = priceImportTemplate('2026-10-27')
    expect(PRICE_IMPORT_HEADER).toBe('material,unit,category,brand,supplier,branch,price,observed_on,sku')
    expect(text).toBe(
      'material,unit,category,brand,supplier,branch,price,observed_on,sku\r\n' +
        'Cemento gris 50 kg,saco,cemento y agregados,Cemex,Home Depot,Tlalpan,245.50,2026-10-27,HD-100\r\n',
    )
    expect(text.split('\r\n')).toHaveLength(3)
    expect(text.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('downloads as material-prices-template.csv from a CSV data link', () => {
    expect(PRICE_IMPORT_TEMPLATE_NAME).toBe('material-prices-template.csv')
    const href = priceImportTemplateHref('2026-10-27')
    expect(href.startsWith('data:text/csv;charset=utf-8,')).toBe(true)
    expect(decodeURIComponent(href.slice('data:text/csv;charset=utf-8,'.length))).toBe(priceImportTemplate('2026-10-27'))
  })
})

describe('row error messages', () => {
  it('maps every error code of the contract to its own message key', () => {
    const keys = contractCodes.map(importErrorKey)
    expect(keys).toEqual(['required', 'invalid', 'futureDate', 'tooManyDecimals', 'archivedMaterial', 'archivedSupplier', 'columns'])
    for (const locale of ['en', 'es'] as const) {
      for (const key of keys) expect(messages[locale].materials.import.rowError[key]).toBeTruthy()
    }
  })

  it('maps an unknown code to the generic row message', () => {
    expect(importErrorKey('SOMETHING_NEW')).toBe('unknown')
  })

  it('names the CSV column in the message, and leaves it out for whole-row errors', () => {
    const t = messages.en.materials.import
    expect(importErrorText({ field: 'price', code: 'TOO_MANY_DECIMALS' }, t)).toBe('price: use at most two decimals.')
    expect(importErrorText({ field: 'row', code: 'COLUMNS' }, t)).toBe('This line does not have the 9 columns of the template.')
    expect(importErrorText({ field: 'observed_on', code: 'FUTURE_DATE' }, messages.es.materials.import)).toBe(
      'observed_on: la fecha no puede ser futura.',
    )
  })
})

describe('confirm rule', () => {
  it('allows confirming only a valid, not yet imported report with prices, while nothing is pending', () => {
    expect(canConfirmImport(validReport, false)).toBe(true)
    expect(canConfirmImport(null, false)).toBe(false)
    expect(canConfirmImport({ ...validReport, valid: false }, false)).toBe(false)
    expect(canConfirmImport(validReport, true)).toBe(false)
    expect(canConfirmImport({ ...validReport, imported: true }, false)).toBe(false)
    expect(canConfirmImport({ ...validReport, rows: [], summary: { ...validReport.summary, rows: 0, observations: 0 } }, false)).toBe(
      false,
    )
  })

  it('counts the rows that have errors', () => {
    const bad = { ...validReport.rows[0], line: 3, errors: [{ field: 'price', code: 'INVALID' }] }
    expect(invalidRowCount({ ...validReport, valid: false, rows: [validReport.rows[0], bad] })).toBe(1)
  })
})

describe('preview cells', () => {
  it('formats a valid price as pesos and shows an invalid one as typed', () => {
    expect(previewPrice('245.5', 'en')).toBe('$245.50')
    expect(previewPrice('12,50', 'en')).toBe('12,50')
    expect(previewPrice(null, 'en')).toBe('—')
  })

  it('formats a valid date and shows an invalid one as typed', () => {
    expect(previewDate('2026-10-20', 'en')).not.toBe('2026-10-20')
    expect(previewDate('20/10/2026', 'en')).toBe('20/10/2026')
    expect(previewDate(undefined, 'en')).toBe('—')
  })
})

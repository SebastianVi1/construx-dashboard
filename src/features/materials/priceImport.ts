import type { Locale, Messages } from '../../i18n'
import { dateText } from '../sites/siteDisplay'
import { moneyText } from './priceRules'
import type { ImportReport, ImportRowError } from './pricingApi'

type ImportMessages = Messages['materials']['import']

/** Exact header the server expects, in this column order. */
export const PRICE_IMPORT_HEADER = 'material,unit,category,brand,supplier,branch,price,observed_on,sku'

export const PRICE_IMPORT_TEMPLATE_NAME = 'material-prices-template.csv'

/** The header plus one example row dated `observedOn`, with CRLF line endings (RFC 4180). */
export function priceImportTemplate(observedOn: string): string {
  const example = ['Cemento gris 50 kg', 'saco', 'cemento y agregados', 'Cemex', 'Home Depot', 'Tlalpan', '245.50', observedOn, 'HD-100']
  return `${PRICE_IMPORT_HEADER}\r\n${example.join(',')}\r\n`
}

/** A link target that downloads the template without asking the server. */
export function priceImportTemplateHref(observedOn: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(priceImportTemplate(observedOn))}`
}

export type ImportErrorKey = keyof ImportMessages['rowError']

const errorKeys: Record<string, ImportErrorKey> = {
  REQUIRED: 'required',
  INVALID: 'invalid',
  FUTURE_DATE: 'futureDate',
  TOO_MANY_DECIMALS: 'tooManyDecimals',
  ARCHIVED_MATERIAL: 'archivedMaterial',
  ARCHIVED_SUPPLIER: 'archivedSupplier',
  COLUMNS: 'columns',
}

/** Message key of a row error code; a code this client does not know gets the generic one. */
export function importErrorKey(code: string): ImportErrorKey {
  return errorKeys[code] ?? 'unknown'
}

/** "price: use at most two decimals.", naming the CSV column so it is easy to find in the file. */
export function importErrorText(error: ImportRowError, t: ImportMessages): string {
  const message = t.rowError[importErrorKey(error.code)]
  if (error.field === 'row') return message.charAt(0).toUpperCase() + message.slice(1)
  return `${error.field}: ${message}`
}

export function invalidRowCount(report: ImportReport): number {
  return report.rows.filter((row) => row.errors.length > 0).length
}

/** The real import is offered only for a valid dry run that has prices to save, once. */
export function canConfirmImport(report: ImportReport | null, pending: boolean): boolean {
  return !pending && report !== null && report.valid && !report.imported && report.summary.observations > 0
}

/** Price cell of the preview: money when it is a valid amount, otherwise the text as written in the file. */
export function previewPrice(price: string | null | undefined, locale: Locale): string {
  if (!price) return '—'
  return /^\d+(\.\d{1,2})?$/.test(price) ? moneyText(price, locale) : price
}

/** Date cell of the preview: a formatted date when it is YYYY-MM-DD, otherwise the text as written. */
export function previewDate(date: string | null | undefined, locale: Locale): string {
  if (!date) return '—'
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? dateText(date, locale) : date
}

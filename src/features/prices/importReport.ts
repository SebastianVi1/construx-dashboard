import type { ImportWarnings, WarningSample } from './catalogImportApi'

/** The import report: warnings grouped by code for the expandable list (docs/pricing.md §4.5). */

export type WarningGroup = { code: string; count: number; samples: WarningSample[] }

/** One group per code, most frequent first then by code; samples are the ones the server kept for that code. */
export function warningGroups(warnings: ImportWarnings): WarningGroup[] {
  return Object.entries(warnings.byCode)
    .map(([code, count]) => ({ code, count, samples: warnings.sample.filter((sample) => sample.code === code) }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

/** A warning detail as `key value` pairs, e.g. `imported 1006.42 · derived 1006.90`. */
export function formatDetail(detail: WarningSample['detail']): string {
  if (!detail) return ''
  return Object.entries(detail)
    .map(([key, value]) => `${key} ${value ?? '-'}`)
    .join(' · ')
}

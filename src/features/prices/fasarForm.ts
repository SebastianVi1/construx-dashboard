import {
  fasarConcepts,
  fasarDayFields,
  type Fasar,
  type FasarBody,
  type FasarConcept,
  type FasarDayField,
  type FasarStatus,
  type LaborDetail,
} from './pricesApi'

/** The FASAR screen as typed: every value a string, as in the inputs. */
export type FasarValues = {
  year: string
  uma: string
  minimumWage: string
  sumEmployerAndWorker: boolean
  days: Record<FasarDayField, string>
  vacationPct: string
  sundayPct: string
  otherChargesPct: string
  excessThresholdUma: string
  sbcCapUma: string
  factorRounding: string
  contributions: Record<FasarConcept, { employerRate: string; workerRate: string }>
}

/** Field keys an error can point at: `year`, `days.holidays`, `contributions.RISK.employerRate`… */
export type FasarErrors = Record<string, FasarErrorKind>

export type FasarErrorKind = 'required' | 'invalid' | 'decimals' | 'fraction' | 'calendar' | 'noWorkingDays' | 'rounding'

function record<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>
}

/** A new set starts with the usual Mexican values: 365 calendar days, 52 Sundays, 15 days of aguinaldo, 25 % premiums, 3 and 25 UMA. */
export function emptyFasarValues(year: number): FasarValues {
  const days = record(fasarDayFields, () => '0')
  days.calendar = '365'
  days.sundays = '52'
  days.bonus = '15'
  return {
    year: String(year),
    uma: '',
    minimumWage: '',
    sumEmployerAndWorker: true,
    days,
    vacationPct: '0.25',
    sundayPct: '0.25',
    otherChargesPct: '0',
    excessThresholdUma: '3',
    sbcCapUma: '25',
    factorRounding: '6',
    contributions: record(fasarConcepts, () => ({ employerRate: '0', workerRate: '0' })),
  }
}

/** The form filled from the stored set; a missing set (or a partial one's gaps) falls back to `emptyFasarValues`. */
export function fasarValuesFrom(fasar: Fasar, currentYear: number): FasarValues {
  const empty = emptyFasarValues(currentYear)
  if (fasar.status === 'NONE') return empty
  const contributions = { ...empty.contributions }
  for (const row of fasar.contributions ?? []) {
    contributions[row.concept] = { employerRate: row.employerRate, workerRate: row.workerRate }
  }
  return {
    year: fasar.year === null ? empty.year : String(fasar.year),
    uma: fasar.uma ?? '',
    minimumWage: fasar.minimumWage ?? '',
    sumEmployerAndWorker: fasar.sumEmployerAndWorker ?? true,
    days: fasar.days ? { ...fasar.days } : empty.days,
    vacationPct: fasar.premiums?.vacationPct ?? empty.vacationPct,
    sundayPct: fasar.premiums?.sundayPct ?? empty.sundayPct,
    otherChargesPct: fasar.premiums?.otherChargesPct ?? empty.otherChargesPct,
    excessThresholdUma: fasar.caps?.excessThresholdUma ?? empty.excessThresholdUma,
    sbcCapUma: fasar.caps?.sbcCapUma ?? empty.sbcCapUma,
    factorRounding: fasar.caps ? String(fasar.caps.factorRounding) : empty.factorRounding,
    contributions,
  }
}

const NUMBER = /^\d+(\.\d+)?$/

function decimals(value: string): number {
  return (value.split('.')[1] ?? '').replace(/0+$/, '').length
}

/** A non-negative decimal with at most `places` decimals; `fraction` also caps it at 1. */
function check(raw: string, places: number, options: { fraction?: boolean; positive?: boolean } = {}): FasarErrorKind | null {
  const value = raw.trim()
  if (value === '') return 'required'
  if (!NUMBER.test(value)) return 'invalid'
  if (decimals(value) > places) return 'decimals'
  if (options.fraction && Number(value) > 1) return 'fraction'
  if (options.positive && Number(value) <= 0) return 'invalid'
  return null
}

/** The rules of `PUT /fasar` (§2.6), so the form reports them before the request. Empty when valid. */
export function validateFasar(values: FasarValues): FasarErrors {
  const errors: FasarErrors = {}
  const put = (key: string, kind: FasarErrorKind | null) => {
    if (kind) errors[key] = kind
  }
  const year = values.year.trim()
  put('year', year === '' ? 'required' : /^\d{4}$/.test(year) ? null : 'invalid')
  put('uma', check(values.uma, 4, { positive: true }))
  put('minimumWage', check(values.minimumWage, 2))
  for (const field of fasarDayFields) put(`days.${field}`, check(values.days[field], 3))
  put('vacationPct', check(values.vacationPct, 8, { fraction: true }))
  put('sundayPct', check(values.sundayPct, 8, { fraction: true }))
  put('otherChargesPct', check(values.otherChargesPct, 8, { fraction: true }))
  put('excessThresholdUma', check(values.excessThresholdUma, 2))
  put('sbcCapUma', check(values.sbcCapUma, 2, { positive: true }))
  const rounding = values.factorRounding.trim()
  put('factorRounding', /^\d$/.test(rounding) && Number(rounding) <= 8 ? null : 'rounding')
  for (const concept of fasarConcepts) {
    put(`contributions.${concept}.employerRate`, check(values.contributions[concept].employerRate, 8, { fraction: true }))
    put(`contributions.${concept}.workerRate`, check(values.contributions[concept].workerRate, 8, { fraction: true }))
  }
  if (!errors['days.calendar'] && Number(values.days.calendar) <= 0) errors['days.calendar'] = 'calendar'
  const tl = workingDays(values)
  if (tl !== null && tl <= 0) errors.days = 'noWorkingDays'
  return errors
}

/** Tl: calendar days minus every day not worked; null while a day count is not a number. */
export function workingDays(values: FasarValues): number | null {
  const counts = fasarDayFields.map((field) => Number(values.days[field].trim() === '' ? NaN : values.days[field]))
  if (counts.some((count) => !Number.isFinite(count))) return null
  const d = values.days
  const off = (['sundays', 'vacation', 'mondays', 'holidays', 'weather', 'custom', 'leaveSick', 'union'] as const).reduce(
    (sum, field) => sum + Number(d[field]) * 1000,
    0,
  )
  return (Number(d.calendar) * 1000 - off) / 1000
}

/** A typed decimal as the API takes it: trimmed, without trailing zeros. */
function plain(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes('.') ? trimmed.replace(/0+$/, '').replace(/\.$/, '') : trimmed
}

/** `PUT /fasar` body from valid values. */
export function fasarBody(values: FasarValues): FasarBody {
  return {
    year: Number(values.year.trim()),
    uma: plain(values.uma),
    minimumWage: Number(values.minimumWage.trim()).toFixed(2),
    sumEmployerAndWorker: values.sumEmployerAndWorker,
    days: record(fasarDayFields, (field) => plain(values.days[field])),
    premiums: { vacationPct: plain(values.vacationPct), sundayPct: plain(values.sundayPct), otherChargesPct: plain(values.otherChargesPct) },
    caps: { excessThresholdUma: plain(values.excessThresholdUma), sbcCapUma: plain(values.sbcCapUma), factorRounding: Number(values.factorRounding.trim()) },
    contributions: fasarConcepts.map((concept) => ({
      concept,
      employerRate: plain(values.contributions[concept].employerRate),
      workerRate: plain(values.contributions[concept].workerRate),
    })),
  }
}

/** Whether a new or edited Labor category's FSR comes from the parameters (only with a complete set). */
export function fsrIsComputed(status: FasarStatus | null | undefined): boolean {
  return status === 'COMPLETE'
}

/**
 * The marker of a Labor category's FSR: `notRecomputable` when it is the imported file's and no complete set
 * can recompute it, `mismatch` when the computed FSR or real wage disagrees with the file, else none.
 */
export function laborFsrBadge(labor: Pick<LaborDetail, 'fsrSource' | 'fsrMismatch'>, status: FasarStatus | null | undefined): 'notRecomputable' | 'mismatch' | null {
  if (labor.fsrSource === 'IMPORTED' && !fsrIsComputed(status)) return 'notRecomputable'
  if (labor.fsrSource === 'COMPUTED' && labor.fsrMismatch) return 'mismatch'
  return null
}

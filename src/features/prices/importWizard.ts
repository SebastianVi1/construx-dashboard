import {
  MAX_IMPORT_BYTES,
  type CatalogImport,
  type ImportErrorKind,
  type ImportKind,
  type ImportStatus,
  type ImportSummary,
} from './catalogImportApi'

/**
 * The Importar tab as a state machine: pick a file, upload it with progress, then follow the job the server
 * runs (validating, validated with its dry run, importing, done or failed). Pure, so the transitions are tested.
 */
export type WizardState =
  | { step: 'pick'; error: ImportErrorKind | null }
  | { step: 'uploading'; fileName: string; progress: number }
  | { step: 'job'; job: CatalogImport; licenceAccepted: boolean; busy: boolean; error: ImportErrorKind | null }

export type WizardEvent =
  | { type: 'fileChosen'; fileName: string }
  | { type: 'progress'; fraction: number }
  | { type: 'jobLoaded'; job: CatalogImport }
  | { type: 'licenceToggled'; accepted: boolean }
  | { type: 'requestStarted' }
  | { type: 'failed'; kind: ImportErrorKind }
  | { type: 'reset' }

export const initialWizard: WizardState = { step: 'pick', error: null }

/** Statuses the server is still working on: the screen polls the job every two seconds. */
const running: ImportStatus[] = ['PENDING', 'VALIDATING', 'IMPORTING']

export const POLL_MS = 2000

export function wizardReducer(state: WizardState, event: WizardEvent): WizardState {
  switch (event.type) {
    case 'fileChosen':
      return { step: 'uploading', fileName: event.fileName, progress: 0 }
    case 'progress':
      return state.step === 'uploading' ? { ...state, progress: Math.min(1, Math.max(0, event.fraction)) } : state
    case 'jobLoaded': {
      const sameJob = state.step === 'job' && state.job.id === event.job.id
      return {
        step: 'job',
        job: event.job,
        // the tick survives polling of the same validated job, never a new job or another state
        licenceAccepted: sameJob && event.job.status === 'VALIDATED' ? state.licenceAccepted : false,
        busy: false,
        error: null,
      }
    }
    case 'licenceToggled':
      return state.step === 'job' && state.job.status === 'VALIDATED' ? { ...state, licenceAccepted: event.accepted } : state
    case 'requestStarted':
      return state.step === 'job' ? { ...state, busy: true, error: null } : state
    case 'failed':
      return state.step === 'job' ? { ...state, busy: false, error: event.kind } : { step: 'pick', error: event.kind }
    case 'reset':
      return initialWizard
  }
}

/** Milliseconds until the next poll, or null when the job needs nothing more from the server. */
export function pollDelay(state: WizardState): number | null {
  return state.step === 'job' && running.includes(state.job.status) ? POLL_MS : null
}

export function canConfirm(state: WizardState): boolean {
  return state.step === 'job' && state.job.status === 'VALIDATED' && state.licenceAccepted && !state.busy
}

export function canCancel(state: WizardState): boolean {
  return state.step === 'job' && (state.job.status === 'PENDING' || state.job.status === 'VALIDATED') && !state.busy
}

/** A finished job (done, failed or cancelled) lets the member start over with another file. */
export function canStartOver(state: WizardState): boolean {
  return state.step === 'job' && ['DONE', 'FAILED', 'CANCELLED'].includes(state.job.status)
}

/**
 * Checked before asking for an upload slot, as the server requires: an `.xlsx` Presupuesto, an `.xls` or `.xlsx`
 * FASAR workbook, each up to 50 MB.
 */
export function checkImportFile(file: { name: string; size: number }, kind: ImportKind = 'PRESUPUESTO'): ImportErrorKind | null {
  const name = file.name.toLowerCase()
  if (kind === 'FASAR' && !name.endsWith('.xls') && !name.endsWith('.xlsx')) return 'fasarFileType'
  if (kind === 'PRESUPUESTO' && !name.endsWith('.xlsx')) return 'fileType'
  if (file.size < 1 || file.size > MAX_IMPORT_BYTES) return 'tooLarge'
  return null
}

/** Progress of uploading the files one after the other, as one fraction weighted by their sizes. */
export function combinedProgress(sizes: number[], index: number, fraction: number): number {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total <= 0) return Math.min(1, (index + fraction) / sizes.length)
  const before = sizes.slice(0, index).reduce((sum, size) => sum + size, 0)
  return Math.min(1, (before + fraction * (sizes[index] ?? 0)) / total)
}

/** Warnings that belong to the FASAR workbook rather than to a mismatch count, in the order they are shown. */
const fasarWarningCodes = ['FASAR_YEAR_OLD', 'FASAR_CATEGORY_NOT_IN_CATALOG', 'FASAR_UNKNOWN_CODE'] as const

export type FasarWarningCode = (typeof fasarWarningCodes)[number]

export type FasarReport = {
  year: number | null
  uma: string | null
  minimumWage: string | null
  categories: number
  fsrMismatches: number
  realWageMismatches: number
  warnings: { code: FasarWarningCode; count: number }[]
}

/** The FASAR section of a dry run (§4.5), or null when the import has no FASAR workbook. */
export function fasarReport(summary: ImportSummary): FasarReport | null {
  const fasar = summary.fasar
  if (!fasar.provided) return null
  return {
    year: fasar.year,
    uma: fasar.uma,
    minimumWage: fasar.minimumWage,
    categories: fasar.laborCategories,
    fsrMismatches: fasar.fsrMismatches,
    realWageMismatches: fasar.realWageMismatches,
    warnings: fasarWarningCodes
      .map((code) => ({ code, count: summary.warnings.byCode[code] ?? 0 }))
      .filter((warning) => warning.count > 0),
  }
}

/** Total Resources per merge outcome across the four types of a dry run. */
export function resourceTotals(job: CatalogImport): { new: number; costChanged: number; unchanged: number; missingFromFile: number } | null {
  const resources = job.summary?.resources
  if (!resources) return null
  const total = { new: 0, costChanged: 0, unchanged: 0, missingFromFile: 0 }
  for (const counts of Object.values(resources)) {
    total.new += counts.new
    total.costChanged += counts.costChanged
    total.unchanged += counts.unchanged
    total.missingFromFile += counts.missingFromFile
  }
  return total
}

/** A file size for people: KB below one megabyte, MB with one decimal above. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Where the remembered active job of an organization lives in this browser. */
export function activeImportKey(organizationId: string): string {
  return `construx.catalogImport.${organizationId}`
}

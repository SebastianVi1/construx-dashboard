import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import { StorageUploadError } from '../../../features/plans/plansApi'
import {
  cancelImport,
  confirmImport,
  getImport,
  importErrorKind,
  requestImportUpload,
  startImport,
  type CatalogImport,
  type ImportStatus,
} from '../../../features/prices/catalogImportApi'
import {
  canCancel,
  canConfirm,
  canStartOver,
  checkImportFile,
  formatFileSize,
  initialWizard,
  pollDelay,
  resourceTotals,
  wizardReducer,
  type WizardState,
} from '../../../features/prices/importWizard'

const counts = (n: number) => ({ new: n, costChanged: 1, unchanged: 2, missingFromFile: 0 })

function job(status: ImportStatus, id = 'imp-1'): CatalogImport {
  return {
    id,
    status,
    file: { name: 'ConstruBASE_Presupuesto.xlsx', sizeBytes: 1200, sha256: 'a'.repeat(64) },
    fasarFile: null,
    uploadedBy: { membershipId: 'm-1', fullName: 'Ana Pérez' },
    createdAt: '2026-11-17T10:00:00Z',
    validatedAt: status === 'PENDING' ? null : '2026-11-17T10:00:05Z',
    confirmedAt: null,
    finishedAt: null,
    licence: null,
    summary:
      status === 'PENDING'
        ? null
        : {
            rows: { CatalogoGeneral: 9, Matrices: 7 },
            resources: { MATERIAL: counts(4), LABOR: counts(3), EQUIPMENT: counts(1), WORK_ITEM: counts(1) },
            units: { new: 6, unchanged: 0 },
            families: { new: 2, unchanged: 0 },
            suppliers: { new: 1, unchanged: 0 },
            fasar: { provided: false, year: null, uma: null, minimumWage: '248.93', laborCategories: 2, fsrMismatches: 0, realWageMismatches: 0 },
            warnings: { total: 4, byCode: { UNIT_NOT_LISTED: 1, GENERAL_FIELDS_PERCENT_SCALE: 3 }, sample: [] },
            changes: { sample: [] },
            missingFromFile: { sample: [] },
          },
    failure: null,
  }
}

function run(events: Parameters<typeof wizardReducer>[1][], from: WizardState = initialWizard): WizardState {
  return events.reduce(wizardReducer, from)
}

describe('import wizard', () => {
  it('uploads with clamped progress and then follows the job', () => {
    const uploading = run([{ type: 'fileChosen', fileName: 'p.xlsx' }, { type: 'progress', fraction: 1.4 }])
    expect(uploading).toEqual({ step: 'uploading', fileName: 'p.xlsx', progress: 1 })
    const pending = wizardReducer(uploading, { type: 'jobLoaded', job: job('PENDING') })
    expect(pending.step).toBe('job')
    expect(pollDelay(pending)).toBe(2000)
    expect(canCancel(pending)).toBe(true)
    expect(canConfirm(pending)).toBe(false)
  })

  it('needs the licence tick to confirm a validated job, and keeps it while polling the same job', () => {
    const validated = run([{ type: 'jobLoaded', job: job('VALIDATED') }])
    expect(pollDelay(validated)).toBeNull()
    expect(canConfirm(validated)).toBe(false)
    const ticked = wizardReducer(validated, { type: 'licenceToggled', accepted: true })
    expect(canConfirm(ticked)).toBe(true)
    expect(canConfirm(wizardReducer(ticked, { type: 'jobLoaded', job: job('VALIDATED') }))).toBe(true)
    expect(canConfirm(wizardReducer(ticked, { type: 'jobLoaded', job: job('VALIDATED', 'imp-2') }))).toBe(false)
    expect(canConfirm(wizardReducer(ticked, { type: 'requestStarted' }))).toBe(false)
  })

  it('ignores the licence tick unless the job is validated', () => {
    const pending = run([{ type: 'jobLoaded', job: job('PENDING') }, { type: 'licenceToggled', accepted: true }])
    expect(pending.step === 'job' && pending.licenceAccepted).toBe(false)
  })

  it('polls while importing and stops when done, failed or cancelled', () => {
    expect(pollDelay(run([{ type: 'jobLoaded', job: job('VALIDATING') }]))).toBe(2000)
    expect(pollDelay(run([{ type: 'jobLoaded', job: job('IMPORTING') }]))).toBe(2000)
    for (const status of ['DONE', 'FAILED', 'CANCELLED'] as const) {
      const state = run([{ type: 'jobLoaded', job: job(status) }])
      expect(pollDelay(state)).toBeNull()
      expect(canCancel(state)).toBe(false)
      expect(canStartOver(state)).toBe(true)
    }
    expect(canCancel(run([{ type: 'jobLoaded', job: job('IMPORTING') }]))).toBe(false)
  })

  it('a failure before the job returns to the picker; after it, stays on the job', () => {
    expect(run([{ type: 'fileChosen', fileName: 'p.xlsx' }, { type: 'failed', kind: 'uploadFailed' }])).toEqual({
      step: 'pick',
      error: 'uploadFailed',
    })
    const onJob = run([{ type: 'jobLoaded', job: job('VALIDATED') }, { type: 'requestStarted' }, { type: 'failed', kind: 'stateConflict' }])
    expect(onJob.step === 'job' && onJob.error).toBe('stateConflict')
    expect(onJob.step === 'job' && onJob.busy).toBe(false)
    expect(run([{ type: 'reset' }], onJob)).toEqual(initialWizard)
  })

  it('checks the file before asking for an upload slot', () => {
    expect(checkImportFile({ name: 'Presupuesto.XLSX', size: 10 })).toBeNull()
    expect(checkImportFile({ name: 'fasar.xls', size: 10 })).toBe('fileType')
    expect(checkImportFile({ name: 'p.xlsx', size: 52_428_801 })).toBe('tooLarge')
    expect(checkImportFile({ name: 'p.xlsx', size: 0 })).toBe('tooLarge')
  })

  it('adds the dry-run counts of the four types', () => {
    expect(resourceTotals(job('VALIDATED'))).toEqual({ new: 9, costChanged: 4, unchanged: 8, missingFromFile: 0 })
    expect(resourceTotals(job('PENDING'))).toBeNull()
  })
})

const base = '/api/organizations/org-1/catalog-imports'
const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

function stubApi(answer: (url: string) => unknown) {
  const get = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : { status: 200, data: answer(url) }))
  // the body is read back from mock.calls
  const post = mock(async (url: string, body?: unknown) => (void body, answer(url)))
  configureHttp({ client: { get, post, put: post, patch: post, delete: post } as unknown as AxiosInstance, baseUrl: '/api' })
  return { get, post }
}

describe('catalog import API', () => {
  afterEach(() => mock.restore())

  it('asks for a Presupuesto upload slot, starts, reads, confirms with the licence and cancels', async () => {
    const { post, get } = stubApi((url) => {
      if (url.endsWith('/uploads')) {
        return { status: 201, data: { uploadId: 'up-1', uploadUrl: 'https://s3/put', headers: { 'Content-Type': 'x' }, expiresAt: '2026-11-17T10:10:00Z' } }
      }
      if (url.endsWith('/confirm')) return { status: 202, data: job('IMPORTING') }
      if (url.endsWith('/cancel')) return { status: 200, data: job('CANCELLED') }
      if (url === base) return { status: 202, data: job('PENDING') }
      return job('VALIDATED')
    })
    const slot = await requestImportUpload('org-1', { name: 'p.xlsx', size: 1200 })
    expect(slot.uploadId).toBe('up-1')
    expect(post.mock.calls[0]?.[1]).toEqual({
      kind: 'PRESUPUESTO',
      fileName: 'p.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 1200,
    })
    expect((await startImport('org-1', 'up-1')).status).toBe('PENDING')
    expect(post.mock.calls[1]?.[1]).toEqual({ presupuestoUploadId: 'up-1', fasarUploadId: null })
    expect((await getImport('org-1', 'imp-1')).summary?.units.new).toBe(6)
    expect(get.mock.calls.some((call) => call[0] === `${base}/imp-1`)).toBe(true)
    expect((await confirmImport('org-1', 'imp-1')).status).toBe('IMPORTING')
    expect(post.mock.calls[2]?.[1]).toEqual({ licenceAccepted: true, statement: 'LICENCE_V1' })
    expect((await cancelImport('org-1', 'imp-1')).status).toBe('CANCELLED')
  })

  it('maps the import error codes', () => {
    expect(importErrorKind(new ApiError(400, undefined, 'IMPORT_FILE_TYPE'))).toBe('fileType')
    expect(importErrorKind(new ApiError(400, undefined, 'IMPORT_FILE_TOO_LARGE'))).toBe('tooLarge')
    expect(importErrorKind(new ApiError(400, undefined, 'IMPORT_UPLOAD_MISMATCH'))).toBe('uploadMissing')
    expect(importErrorKind(new ApiError(409, undefined, 'IMPORT_IN_PROGRESS'))).toBe('inProgress')
    expect(importErrorKind(new ApiError(400, undefined, 'LICENCE_NOT_ACCEPTED'))).toBe('licence')
    expect(importErrorKind(new ApiError(409, undefined, 'STATE_CONFLICT'))).toBe('stateConflict')
    expect(importErrorKind(new StorageUploadError(500))).toBe('uploadFailed')
    expect(importErrorKind(new ApiError(403))).toBe('forbidden')
  })
})

describe('formatFileSize', () => {
  it('shows KB under a megabyte and MB above', () => {
    expect(formatFileSize(1200)).toBe('1 KB')
    expect(formatFileSize(18_234_567)).toBe('17.4 MB')
  })
})

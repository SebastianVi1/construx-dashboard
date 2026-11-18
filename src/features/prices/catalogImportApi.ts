import { z } from 'zod'
import { ApiError, getJson, sendJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'
import { StorageUploadError } from '../plans/plansApi'
import { pageSchema, pricesErrorKind, type Page, type PricesErrorKind } from './pricesApi'

/** Catalog import from the PU Win+ Presupuesto workbook (backend `docs/pricing.md` §4). */

export const importStatuses = ['PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'DONE', 'FAILED', 'CANCELLED'] as const

export type ImportStatus = (typeof importStatuses)[number]

/** The key of the licence statement shown with the confirm checkbox (§4.4). */
export const LICENCE_STATEMENT = 'LICENCE_V1'

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const XLS_TYPE = 'application/vnd.ms-excel'

/** The Presupuesto workbook, or the optional FASAR workbook beside it (§4.1). */
export type ImportKind = 'PRESUPUESTO' | 'FASAR'

/** The Excel type the server expects for a file name: `.xls` (FASAR only) or `.xlsx`. */
export function importContentType(fileName: string): string {
  return fileName.toLowerCase().endsWith('.xls') ? XLS_TYPE : XLSX_TYPE
}

/** 50 MB, the server's limit for an import workbook. */
export const MAX_IMPORT_BYTES = 52_428_800

const countsSchema = z.object({
  new: z.number().int(),
  costChanged: z.number().int(),
  unchanged: z.number().int(),
  missingFromFile: z.number().int(),
})

const newUnchangedSchema = z.object({ new: z.number().int(), unchanged: z.number().int() })

const resourceTypeSchema = z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'WORK_ITEM'])

/** One warning of a dry run; `detail` holds code-specific values such as the imported and derived cost. */
export const warningSampleSchema = z.object({
  code: z.string(),
  sheet: z.string().nullable(),
  row: z.number().int().nullable(),
  resourceCode: z.string().nullable(),
  detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable(),
})

export type WarningSample = z.infer<typeof warningSampleSchema>

export const warningsSchema = z.object({
  total: z.number().int(),
  byCode: z.record(z.string(), z.number().int()),
  sample: z.array(warningSampleSchema),
})

export type ImportWarnings = z.infer<typeof warningsSchema>

const changeSampleSchema = z.object({
  resourceCode: z.string(),
  type: resourceTypeSchema,
  name: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
})

const missingSampleSchema = z.object({ resourceCode: z.string(), type: resourceTypeSchema, name: z.string() })

/** The dry-run summary (§4.5); each sample holds at most 200 entries, the totals are in the counts. */
export const importSummarySchema = z.object({
  rows: z.record(z.string(), z.number().int()),
  resources: z.object({ MATERIAL: countsSchema, LABOR: countsSchema, EQUIPMENT: countsSchema, WORK_ITEM: countsSchema }),
  units: newUnchangedSchema,
  families: newUnchangedSchema,
  suppliers: newUnchangedSchema,
  fasar: z.object({
    provided: z.boolean(),
    year: z.number().int().nullable(),
    uma: z.string().nullable(),
    minimumWage: z.string().nullable(),
    laborCategories: z.number().int(),
    fsrMismatches: z.number().int(),
    realWageMismatches: z.number().int(),
  }),
  warnings: warningsSchema,
  changes: z.object({ sample: z.array(changeSampleSchema) }),
  missingFromFile: z.object({ sample: z.array(missingSampleSchema) }),
})

export type ImportSummary = z.infer<typeof importSummarySchema>

const personSchema = z.object({ membershipId: z.string().min(1), fullName: z.string().nullable() })
const fileSchema = z.object({ name: z.string(), sizeBytes: z.number().int(), sha256: z.string() })

export const catalogImportSchema = z.object({
  id: z.string().min(1),
  status: z.enum(importStatuses),
  file: fileSchema,
  fasarFile: fileSchema.nullable(),
  uploadedBy: personSchema.nullable(),
  createdAt: z.string(),
  validatedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  licence: z.object({ statement: z.string(), acceptedAt: z.string(), acceptedBy: personSchema.nullable() }).nullable(),
  summary: importSummarySchema.nullable(),
  failure: z
    .object({
      code: z.string(),
      message: z.string().nullable(),
      sheet: z.string().nullable(),
      row: z.number().int().nullable(),
      column: z.string().nullable(),
    })
    .nullable(),
})

export type CatalogImport = z.infer<typeof catalogImportSchema>

export const importUploadSchema = z.object({
  uploadId: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export type ImportUpload = z.infer<typeof importUploadSchema>

function importsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/catalog-imports`
}

function importPath(organizationId: string, importId: string): string {
  return `${importsPath(organizationId)}/${encodeURIComponent(importId)}`
}

/** Step 1: a presigned upload slot for the Presupuesto workbook, or for the FASAR workbook. */
export function requestImportUpload(
  organizationId: string,
  file: { name: string; size: number },
  kind: ImportKind = 'PRESUPUESTO',
): Promise<ImportUpload> {
  return sendJson(
    'post',
    `${importsPath(organizationId)}/uploads`,
    { kind, fileName: file.name, contentType: kind === 'FASAR' ? importContentType(file.name) : XLSX_TYPE, sizeBytes: file.size },
    201,
    importUploadSchema,
  )
}

/** Step 3, after the bytes are in storage: start the job; validation runs in the background. */
export function startImport(organizationId: string, uploadId: string, fasarUploadId: string | null = null): Promise<CatalogImport> {
  return sendJson('post', importsPath(organizationId), { presupuestoUploadId: uploadId, fasarUploadId }, 202, catalogImportSchema)
}

/** Rows of the import history. */
export const IMPORT_PAGE_SIZE = 20

const importPageSchema = pageSchema(catalogImportSchema)

/** Past and current imports of the company, newest first (§4.3). */
export function listImports(organizationId: string, page: number): Promise<Page<CatalogImport>> {
  return getJson(`${importsPath(organizationId)}?page=${page}&size=${IMPORT_PAGE_SIZE}`, importPageSchema)
}

export function getImport(organizationId: string, importId: string): Promise<CatalogImport> {
  return getJson(importPath(organizationId, importId), catalogImportSchema)
}

export function confirmImport(organizationId: string, importId: string): Promise<CatalogImport> {
  return sendJson(
    'post',
    `${importPath(organizationId, importId)}/confirm`,
    { licenceAccepted: true, statement: LICENCE_STATEMENT },
    202,
    catalogImportSchema,
  )
}

export function cancelImport(organizationId: string, importId: string): Promise<CatalogImport> {
  return sendJson('post', `${importPath(organizationId, importId)}/cancel`, {}, 200, catalogImportSchema)
}

export type ImportErrorKind =
  | 'fileType'
  | 'fasarFileType'
  | 'tooLarge'
  | 'uploadMissing'
  | 'inProgress'
  | 'licence'
  | 'stateConflict'
  | 'uploadFailed'
  | PricesErrorKind

/** Message to show when an import request fails. */
export function importErrorKind(error: unknown): ImportErrorKind {
  if (error instanceof StorageUploadError) return 'uploadFailed'
  if (error instanceof ApiError) {
    if (error.code === 'IMPORT_FILE_TYPE') return 'fileType'
    if (error.code === 'IMPORT_FILE_TOO_LARGE') return 'tooLarge'
    if (error.code === 'IMPORT_UPLOAD_MISSING' || error.code === 'IMPORT_UPLOAD_MISMATCH') return 'uploadMissing'
    if (error.code === 'IMPORT_IN_PROGRESS') return 'inProgress'
    if (error.code === 'LICENCE_NOT_ACCEPTED') return 'licence'
    if (error.status === 409 && error.code === 'STATE_CONFLICT') return 'stateConflict'
  }
  return pricesErrorKind(error)
}

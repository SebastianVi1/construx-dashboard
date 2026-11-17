import { z, type ZodType } from 'zod'
import { getJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'
import { resourceTypes, resourcesQueryString, type ResourcesRequest } from './resourceQuery'

/**
 * Catalog reads of `construx/docs/pricing.md` §2 (VIEW_PRICES). Money is a
 * string with exactly two decimals in MXN; instants are ISO-8601 UTC; dates
 * are `YYYY-MM-DD`.
 */

const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/)
/** Factors and quantities: decimal strings with up to eight decimals. */
const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/)
const idSchema = z.string().min(1)
const countSchema = z.number().int().nonnegative()

/** A paged list: `{ content, page, size, totalElements, totalPages }`, `page` zero-based. */
export function pageSchema<T>(item: ZodType<T>) {
  return z.object({
    content: z.array(item),
    page: countSchema,
    size: countSchema,
    totalElements: countSchema,
    totalPages: countSchema,
  })
}

export type Page<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export const resourceTypeSchema = z.enum(resourceTypes)

/** Where a Resource came from. */
export const resourceSources = ['MANUAL', 'CSV', 'NEODATA_CONSTRUBASE'] as const
/** Where a Cost history entry came from; FASAR is a wage recalculation. */
export const costSources = ['MANUAL', 'CSV', 'NEODATA_CONSTRUBASE', 'FASAR'] as const
/** Where a Unit or Family came from; SEED is the migration from the old Materials. */
export const catalogEntrySources = ['SEED', 'MANUAL', 'NEODATA_CONSTRUBASE'] as const

export type CostSource = (typeof costSources)[number]
export type ResourceSource = (typeof resourceSources)[number]

/** `ResourceResponse`: one row of the resources table. */
export const resourceSchema = z.object({
  id: idSchema,
  code: z.string(),
  type: resourceTypeSchema,
  name: z.string(),
  unit: z.object({ id: idSchema, code: z.string() }),
  family: z.object({ id: idSchema, code: z.string(), name: z.string() }).nullable(),
  supplier: z.object({ id: idSchema, name: z.string() }).nullable(),
  brand: z.string().nullable(),
  isPercentage: z.boolean(),
  isComposite: z.boolean(),
  isHourlyCost: z.boolean(),
  discontinued: z.boolean(),
  currentCost: moneySchema.nullable(),
  costUpdatedAt: z.string().nullable(),
  source: z.enum(resourceSources),
  missingFromImportAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
})

export type Resource = z.infer<typeof resourceSchema>

/** One Cost history entry; entries are immutable. */
export const costEntrySchema = z.object({
  id: idSchema,
  amount: moneySchema,
  effectiveFrom: z.string(),
  source: z.enum(costSources),
  recordedBy: z.object({ membershipId: idSchema, fullName: z.string() }).nullable(),
  importId: z.string().nullable(),
  supplier: z.object({ id: idSchema, name: z.string() }).nullable(),
  sku: z.string().nullable(),
  note: z.string().nullable(),
})

export type CostEntry = z.infer<typeof costEntrySchema>

/**
 * `ResourceDetailResponse`. `history` (simple Resources only) holds the last
 * 100 entries newest first. `laborDetail`, `equipmentDetail` and `analysis`
 * belong to later slices and are not read here.
 */
export const resourceDetailSchema = resourceSchema.extend({
  description: z.string().nullable(),
  reference: z.string().nullable(),
  sapCode: z.string().nullable(),
  technicalSheet: z.string().nullable(),
  procedure: z.string().nullable(),
  grouper: z.string().nullable(),
  importedCost: moneySchema.nullable(),
  importedCostOn: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  history: z.array(costEntrySchema).nullish(),
  usedIn: z.object({
    count: countSchema,
    sample: z.array(z.object({ id: idSchema, code: z.string(), name: z.string(), type: resourceTypeSchema })),
  }),
})

export type ResourceDetail = z.infer<typeof resourceDetailSchema>

/** The detail returns at most this many history entries; the rest is at `/costs`. */
export const DETAIL_HISTORY_LIMIT = 100

export const unitSchema = z.object({
  id: idSchema,
  code: z.string(),
  description: z.string().nullable(),
  source: z.enum(catalogEntrySources),
  archivedAt: z.string().nullable(),
  resourceCount: countSchema,
})

export type Unit = z.infer<typeof unitSchema>

export const familySchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  source: z.enum(catalogEntrySources),
  archivedAt: z.string().nullable(),
  resourceCount: countSchema,
})

export type Family = z.infer<typeof familySchema>

/** `SupplierResponse`, only the fields the supplier filter needs. */
export const supplierSchema = z.object({
  id: idSchema,
  name: z.string(),
  branch: z.string().nullable(),
  archivedAt: z.string().nullable(),
})

export type Supplier = z.infer<typeof supplierSchema>

/** `GET /catalog`: counts per type, the last import and the FASAR state. */
export const catalogSummarySchema = z.object({
  exists: z.boolean(),
  /** `MXN`; null together with `exists: false` (no Catalog yet). Not rendered: amounts follow the display currency. */
  currency: z.string().nullable(),
  counts: z.object({
    MATERIAL: countSchema,
    LABOR: countSchema,
    EQUIPMENT: countSchema,
    WORK_ITEM: countSchema,
    suppliers: countSchema,
    units: countSchema,
    families: countSchema,
  }),
  missingFromImport: countSchema,
  lastImport: z
    .object({ id: idSchema, status: z.string(), finishedAt: z.string().nullable(), fileName: z.string() })
    .nullable(),
  fasar: z.object({
    status: z.enum(['NONE', 'PARTIAL', 'COMPLETE']),
    year: z.number().int().nullish(),
    uma: decimalSchema.nullish(),
    minimumWage: moneySchema.nullish(),
    updatedAt: z.string().nullish(),
  }),
  /** The running import job (`ImportResponse` of §4.3); only its id and status are read here. */
  activeImport: z.object({ id: idSchema, status: z.string() }).nullable(),
})

export type CatalogSummary = z.infer<typeof catalogSummarySchema>

function resourcesPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/resources`
}

function resourcePath(organizationId: string, resourceId: string): string {
  return `${resourcesPath(organizationId)}/${encodeURIComponent(resourceId)}`
}

export function getCatalog(organizationId: string): Promise<CatalogSummary> {
  return getJson(`${organizationPath(organizationId)}/catalog`, catalogSummarySchema)
}

/** One page of the organization's Resources matching the filters. */
export function listResources(organizationId: string, request: ResourcesRequest): Promise<Page<Resource>> {
  return getJson(`${resourcesPath(organizationId)}${resourcesQueryString(request)}`, pageSchema(resourceSchema))
}

/** A Resource with its descriptive fields and its last 100 Cost history entries; archived ones too. */
export function getResource(organizationId: string, resourceId: string): Promise<ResourceDetail> {
  return getJson(resourcePath(organizationId, resourceId), resourceDetailSchema)
}

/** Rows per page when reading the full history (the API's maximum). */
export const COSTS_PAGE_SIZE = 200

/** The full Cost history of a Resource, newest first (the order is fixed by the server). */
export function listResourceCosts(organizationId: string, resourceId: string, page = 0): Promise<Page<CostEntry>> {
  const path = `${resourcePath(organizationId, resourceId)}/costs?page=${page}&size=${COSTS_PAGE_SIZE}`
  return getJson(path, pageSchema(costEntrySchema))
}

/** Active Units ordered by code. */
export function listUnits(organizationId: string): Promise<Unit[]> {
  return getJson(`${organizationPath(organizationId)}/units`, z.array(unitSchema))
}

/** Active Families ordered by code. */
export function listFamilies(organizationId: string): Promise<Family[]> {
  return getJson(`${organizationPath(organizationId)}/families`, z.array(familySchema))
}

/** Active Suppliers. */
export function listSuppliers(organizationId: string): Promise<Supplier[]> {
  return getJson(`${organizationPath(organizationId)}/suppliers`, z.array(supplierSchema))
}

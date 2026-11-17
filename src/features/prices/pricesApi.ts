import { z } from 'zod'
import { ApiError, getJson, sendJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'

/** The cost catalog API (backend `docs/pricing.md` §2.1 to §2.5): reads, Units, Families and Suppliers writes, and hand-made Resources. */

export const resourceTypes = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'WORK_ITEM'] as const

export type ResourceType = (typeof resourceTypes)[number]

export const resourceSortFields = ['code', 'name', 'currentCost', 'costUpdatedAt'] as const

export type ResourceSortField = (typeof resourceSortFields)[number]

export type SortDirection = 'asc' | 'desc'

export type ResourceSort = { field: ResourceSortField; direction: SortDirection }

/** Money is a decimal string with two decimals, MXN. */
const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/)

const catalogSourceSchema = z.enum(['SEED', 'MANUAL', 'CSV', 'NEODATA_CONSTRUBASE'])

const costSourceSchema = z.enum(['MANUAL', 'CSV', 'NEODATA_CONSTRUBASE', 'FASAR'])

export type CostSource = z.infer<typeof costSourceSchema>

const supplierRefSchema = z.object({ id: z.string().min(1), name: z.string() })

/** `ResourceResponse`: one list row. */
export const resourceSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  type: z.enum(resourceTypes),
  name: z.string(),
  unit: z.object({ id: z.string().min(1), code: z.string() }),
  family: z.object({ id: z.string().min(1), code: z.string(), name: z.string() }).nullable(),
  supplier: supplierRefSchema.nullable(),
  brand: z.string().nullable(),
  isPercentage: z.boolean(),
  isComposite: z.boolean(),
  isHourlyCost: z.boolean(),
  discontinued: z.boolean(),
  currentCost: moneySchema.nullable(),
  costUpdatedAt: z.string().nullable(),
  source: catalogSourceSchema,
  missingFromImportAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
})

export type Resource = z.infer<typeof resourceSchema>

/** One immutable Cost history entry. */
export const costSchema = z.object({
  id: z.string().min(1),
  amount: moneySchema,
  effectiveFrom: z.string(),
  source: costSourceSchema,
  recordedBy: z.object({ membershipId: z.string().min(1), fullName: z.string() }).nullable(),
  importId: z.string().nullable(),
  supplier: supplierRefSchema.nullable(),
  sku: z.string().nullable(),
  note: z.string().nullable(),
})

export type Cost = z.infer<typeof costSchema>

/** Quantities and factors: plain decimal strings without trailing zeros (`"0.03"`, `"1.7"`). */
const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/)

/** One line of a Unit price analysis; `*` is a consumption, `/` an output per day. */
export const analysisLineSchema = z.object({
  lineNo: z.number().int(),
  component: z.object({
    id: z.string().min(1),
    code: z.string(),
    name: z.string(),
    type: z.enum(resourceTypes),
    unitCode: z.string(),
    isPercentage: z.boolean(),
    currentCost: moneySchema.nullable(),
  }),
  operator: z.enum(['*', '/']),
  quantity: decimalSchema,
  expression: z.string().nullable(),
  amount: moneySchema,
})

export type AnalysisLine = z.infer<typeof analysisLineSchema>

/** The derived cost of a composite: `mismatch` against the file's cost, `incomplete` when a component has no cost. */
export const analysisSchema = z.object({
  derivedCost: moneySchema,
  importedCost: moneySchema.nullable(),
  mismatch: z.boolean(),
  incomplete: z.boolean(),
  laborSubtotal: moneySchema,
  lines: z.array(analysisLineSchema),
})

export type Analysis = z.infer<typeof analysisSchema>

/** The wage of a simple Labor category; `realWage` is its cost. */
export const laborDetailSchema = z.object({
  nominalWage: moneySchema,
  fsr: decimalSchema,
  fsrSource: z.enum(['IMPORTED', 'MANUAL', 'COMPUTED']),
  fsbc: decimalSchema.nullable(),
  sbc: moneySchema.nullable(),
  perDiem: moneySchema,
  mealsLodging: moneySchema,
  funeralExpenses: moneySchema,
  otherBenefits: moneySchema,
  fasarType: z.number().int().nullable(),
  imported: z.object({
    fsr: decimalSchema.nullable(),
    realWage: moneySchema.nullable(),
    fsbc: decimalSchema.nullable(),
    sbc: moneySchema.nullable(),
  }),
  fsrMismatch: z.boolean(),
  realWage: moneySchema.nullable(),
})

export type LaborDetail = z.infer<typeof laborDetailSchema>

const equipmentLineSchema = z.object({
  lineNo: z.number().int(),
  component: z.object({
    id: z.string().min(1),
    code: z.string(),
    name: z.string(),
    type: z.enum(resourceTypes),
    unit: z.object({ id: z.string().min(1), code: z.string() }),
  }),
  operator: z.enum(['*', '/']),
  quantity: decimalSchema,
})

export type EquipmentLine = z.infer<typeof equipmentLineSchema>

const optionalText = z.string().nullable().default(null)
const optionalDecimal = decimalSchema.nullable().default(null)
const optionalInt = z.number().int().nullable().default(null)

/** The machinery data of an Equipment rate as imported; display only, nothing is recomputed from it. */
export const equipmentDetailSchema = z.object({
  powerUnit: optionalText,
  fixedChargeCode: optionalText,
  acquisitionValueCode: optionalText,
  standbyCode: optionalText,
  reserveCode: optionalText,
  tiresCode: optionalText,
  specialPartsCode: optionalText,
  fuelCode: optionalText,
  lubricantCode: optionalText,
  otherEnergyCode: optionalText,
  tiresLifeHours: optionalDecimal,
  specialPartsLifeHours: optionalDecimal,
  economicLifeHours: optionalDecimal,
  hoursPerYear: optionalDecimal,
  oilChangeHours: optionalDecimal,
  calculationType: optionalInt,
  power: optionalDecimal,
  operationFactor: optionalDecimal,
  fuelType: optionalInt,
  fuelFactor: optionalDecimal,
  otherEnergyFactor: optionalDecimal,
  lubricantFactor: optionalDecimal,
  crankcaseCapacity: optionalDecimal,
  salvagePct: optionalDecimal,
  insurancePct: optionalDecimal,
  maintenanceFactor: optionalDecimal,
  interestRate: optionalDecimal,
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  capacity: optionalText,
  location: optionalText,
  usefulLife: optionalText,
  owner: optionalText,
  availability: optionalText,
  commercialValue: moneySchema.nullable().default(null),
  fuelQtyPerHour: optionalDecimal,
  lubricantQtyPerHour: optionalDecimal,
  operationLines: z.array(equipmentLineSchema),
  consumptionLines: z.array(equipmentLineSchema),
})

export type EquipmentDetail = z.infer<typeof equipmentDetailSchema>

/**
 * `ResourceDetailResponse`; `history` is the newest 100 entries, null for a composite. `analysis` only on
 * composites, `laborDetail` on simple Labor categories, `equipmentDetail` on Equipment rates with machinery data.
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
  history: z.array(costSchema).nullable(),
  laborDetail: laborDetailSchema.nullable(),
  equipmentDetail: equipmentDetailSchema.nullable(),
  analysis: analysisSchema.nullable(),
  usedIn: z.object({
    count: z.number().int(),
    sample: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), type: z.enum(resourceTypes) })),
  }),
})

export type ResourceDetail = z.infer<typeof resourceDetailSchema>

function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    content: z.array(item),
    page: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
    totalPages: z.number().int(),
  })
}

export type Page<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export const catalogSchema = z.object({
  exists: z.boolean(),
  currency: z.string(),
  counts: z.object({
    MATERIAL: z.number().int(),
    LABOR: z.number().int(),
    EQUIPMENT: z.number().int(),
    WORK_ITEM: z.number().int(),
    suppliers: z.number().int(),
    units: z.number().int(),
    families: z.number().int(),
  }),
  missingFromImport: z.number().int(),
  lastImport: z.unknown().nullable(),
  fasar: z
    .object({
      status: z.enum(['NONE', 'PARTIAL', 'COMPLETE']),
      year: z.number().int().nullable(),
      uma: decimalSchema.nullable(),
      minimumWage: moneySchema.nullable(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
  activeImport: z.unknown().nullable(),
})

export type CatalogSummary = z.infer<typeof catalogSchema>

export const unitSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  description: z.string().nullable(),
  source: catalogSourceSchema,
  archivedAt: z.string().nullable(),
  resourceCount: z.number().int(),
})

export type Unit = z.infer<typeof unitSchema>

export const familySchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  source: catalogSourceSchema,
  archivedAt: z.string().nullable(),
  resourceCount: z.number().int(),
})

export type Family = z.infer<typeof familySchema>

export const supplierSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  branch: z.string().nullable(),
  website: z.string().nullable(),
  /** Neodata `Proveedor`; read-only when `source` is `NEODATA_CONSTRUBASE`. */
  code: z.string().nullable(),
  rfc: z.string().nullable(),
  address: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  fax: z.string().nullable(),
  email: z.string().nullable(),
  contact: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  source: catalogSourceSchema,
  archivedAt: z.string().nullable(),
  resourceCount: z.number().int(),
})

export type Supplier = z.infer<typeof supplierSchema>

/** What the Resource table asks for; unset filters are left out of the request. */
export type ResourceQuery = {
  types?: ResourceType[]
  query?: string
  familyId?: string
  unitId?: string
  supplierId?: string
  includeArchived?: boolean
  /** null or undefined: both. */
  discontinued?: boolean | null
  /** Labor tab: true for Gangs, false for categories; null or undefined: both. */
  composite?: boolean | null
  sort?: ResourceSort
  page: number
  size: number
}

export const PAGE_SIZE = 50

/** Query string of `GET /resources`, `type` repeated, in a stable order. */
export function resourceSearch(query: ResourceQuery): string {
  const search = new URLSearchParams()
  for (const type of query.types ?? []) search.append('type', type)
  const text = query.query?.trim()
  if (text) search.set('query', text)
  if (query.familyId) search.set('familyId', query.familyId)
  if (query.unitId) search.set('unitId', query.unitId)
  if (query.supplierId) search.set('supplierId', query.supplierId)
  if (query.includeArchived) search.set('includeArchived', 'true')
  if (query.discontinued !== undefined && query.discontinued !== null) search.set('discontinued', String(query.discontinued))
  if (query.composite !== undefined && query.composite !== null) search.set('composite', String(query.composite))
  if (query.sort) search.set('sort', `${query.sort.field},${query.sort.direction}`)
  search.set('page', String(query.page))
  search.set('size', String(query.size))
  return search.toString()
}

function resourcesPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/resources`
}

function resourcePath(organizationId: string, resourceId: string): string {
  return `${resourcesPath(organizationId)}/${encodeURIComponent(resourceId)}`
}

export function getCatalog(organizationId: string): Promise<CatalogSummary> {
  return getJson(`${organizationPath(organizationId)}/catalog`, catalogSchema)
}

export function listResources(organizationId: string, query: ResourceQuery): Promise<Page<Resource>> {
  return getJson(`${resourcesPath(organizationId)}?${resourceSearch(query)}`, pageSchema(resourceSchema))
}

export function getResource(organizationId: string, resourceId: string): Promise<ResourceDetail> {
  return getJson(resourcePath(organizationId, resourceId), resourceDetailSchema)
}

/** The whole Cost history, newest first, one page at a time. */
export function listResourceCosts(organizationId: string, resourceId: string, page: number, size = PAGE_SIZE): Promise<Page<Cost>> {
  return getJson(`${resourcePath(organizationId, resourceId)}/costs?page=${page}&size=${size}`, pageSchema(costSchema))
}

export type ListOptions = { includeArchived?: boolean }

function listSearch(options: ListOptions & { query?: string }): string {
  const search = new URLSearchParams()
  const text = options.query?.trim()
  if (text) search.set('query', text)
  if (options.includeArchived) search.set('includeArchived', 'true')
  const query = search.toString()
  return query ? `?${query}` : ''
}

function unitsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/units`
}

function familiesPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/families`
}

function suppliersPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/suppliers`
}

/** Units ordered by code; archived ones only when asked. */
export function listUnits(organizationId: string, options: ListOptions = {}): Promise<Unit[]> {
  return getJson(`${unitsPath(organizationId)}${listSearch(options)}`, z.array(unitSchema))
}

/** Families ordered by code; archived ones only when asked. */
export function listFamilies(organizationId: string, options: ListOptions = {}): Promise<Family[]> {
  return getJson(`${familiesPath(organizationId)}${listSearch(options)}`, z.array(familySchema))
}

/** Suppliers ordered by name; `query` matches name, code or contact. */
export function listSuppliers(organizationId: string, options: ListOptions & { query?: string } = {}): Promise<Supplier[]> {
  return getJson(`${suppliersPath(organizationId)}${listSearch(options)}`, z.array(supplierSchema))
}

export type UnitCreate = { code: string; description?: string }
/** `description: ''` clears it; the code never changes. */
export type UnitPatch = { description?: string }
export type FamilyCreate = { code: string; name: string }
export type FamilyPatch = { name?: string }

/** Writable supplier fields; on a patch, a field left out keeps its value and `''` clears it. */
export type SupplierBody = Partial<{
  name: string
  branch: string
  website: string
  code: string
  rfc: string
  address: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
  phone: string
  mobile: string
  fax: string
  email: string
  contact: string
  notes: string
  isDefault: boolean
}>

export function createUnit(organizationId: string, body: UnitCreate): Promise<Unit> {
  return sendJson('post', unitsPath(organizationId), body, 201, unitSchema)
}

export function updateUnit(organizationId: string, unitId: string, body: UnitPatch): Promise<Unit> {
  return sendJson('patch', `${unitsPath(organizationId)}/${encodeURIComponent(unitId)}`, body, 200, unitSchema)
}

export function archiveUnit(organizationId: string, unitId: string): Promise<Unit> {
  return sendJson('post', `${unitsPath(organizationId)}/${encodeURIComponent(unitId)}/archive`, undefined, 200, unitSchema)
}

export function createFamily(organizationId: string, body: FamilyCreate): Promise<Family> {
  return sendJson('post', familiesPath(organizationId), body, 201, familySchema)
}

export function updateFamily(organizationId: string, familyId: string, body: FamilyPatch): Promise<Family> {
  return sendJson('patch', `${familiesPath(organizationId)}/${encodeURIComponent(familyId)}`, body, 200, familySchema)
}

export function archiveFamily(organizationId: string, familyId: string): Promise<Family> {
  return sendJson('post', `${familiesPath(organizationId)}/${encodeURIComponent(familyId)}/archive`, undefined, 200, familySchema)
}

export function createSupplier(organizationId: string, body: SupplierBody & { name: string }): Promise<Supplier> {
  return sendJson('post', suppliersPath(organizationId), body, 201, supplierSchema)
}

export function updateSupplier(organizationId: string, supplierId: string, body: SupplierBody): Promise<Supplier> {
  return sendJson('patch', `${suppliersPath(organizationId)}/${encodeURIComponent(supplierId)}`, body, 200, supplierSchema)
}

export function archiveSupplier(organizationId: string, supplierId: string): Promise<Supplier> {
  return sendJson('post', `${suppliersPath(organizationId)}/${encodeURIComponent(supplierId)}/archive`, undefined, 200, supplierSchema)
}

/**
 * The wage of a Labor category in pesos with two decimals; the FSR is a factor from 1 to 3, left out when complete
 * FASAR parameters compute it.
 */
export type LaborWageBody = {
  nominalWage: string
  fsr?: string
  perDiem: string
  mealsLodging: string
  funeralExpenses: string
  otherBenefits: string
}

type ResourceCreateCommon = {
  code: string
  name: string
  description: string | null
  unitId: string
  familyId: string | null
  supplierId: string | null
}

/**
 * `POST /resources` for a simple Material or Equipment rate (with its first cost) or a Labor category (with its
 * wage, whose real wage becomes the first cost); money in pesos with two decimals.
 */
export type ResourceCreateBody =
  | (ResourceCreateCommon & { type: 'MATERIAL' | 'EQUIPMENT'; brand?: string | null; cost: string })
  | (ResourceCreateCommon & { type: 'LABOR'; laborDetail: LaborWageBody })

/** Fields left out keep their value; `''` clears an optional text, the family or the supplier. */
export type ResourcePatchBody = Partial<{
  name: string
  description: string
  unitId: string
  familyId: string
  supplierId: string
  brand: string
  /** Only on a simple Labor category; a changed real wage writes a cost history entry. */
  laborDetail: Partial<LaborWageBody>
}>

export type CostEntryBody = { amount: string; supplierId: string | null; sku: string | null; note: string | null }

export function createResource(organizationId: string, body: ResourceCreateBody): Promise<ResourceDetail> {
  return sendJson('post', resourcesPath(organizationId), body, 201, resourceDetailSchema)
}

export function updateResource(organizationId: string, resourceId: string, body: ResourcePatchBody): Promise<ResourceDetail> {
  return sendJson('patch', resourcePath(organizationId, resourceId), body, 200, resourceDetailSchema)
}

/** Idempotent; the Resource leaves lists and pickers but keeps its history. */
export function archiveResource(organizationId: string, resourceId: string): Promise<ResourceDetail> {
  return sendJson('post', `${resourcePath(organizationId, resourceId)}/archive`, undefined, 200, resourceDetailSchema)
}

/** A new Cost history entry effective now; it becomes the current cost. */
export function recordResourceCost(organizationId: string, resourceId: string, body: CostEntryBody): Promise<ResourceDetail> {
  return sendJson('post', `${resourcePath(organizationId, resourceId)}/costs`, body, 201, resourceDetailSchema)
}

/** Standby and reserve shares per equipment charge, catalog-wide. */
export const standbyPercentageSchema = z.object({ charge: z.string(), standbyPct: decimalSchema, reservePct: decimalSchema })

export type StandbyPercentage = z.infer<typeof standbyPercentageSchema>

export function listStandbyPercentages(organizationId: string): Promise<StandbyPercentage[]> {
  return getJson(`${organizationPath(organizationId)}/equipment-standby-percentages`, z.array(standbyPercentageSchema))
}

export type PricesErrorKind = 'invalid' | 'session' | 'forbidden' | 'notFound' | 'generic'

/** Message to show when a catalog read fails. */
export function pricesErrorKind(error: unknown): PricesErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

export type CatalogWriteErrorKind =
  | 'duplicateSupplier'
  | 'duplicateUnit'
  | 'duplicateFamily'
  | 'importedField'
  | PricesErrorKind

const conflictKinds: Record<string, CatalogWriteErrorKind> = {
  DUPLICATE_SUPPLIER: 'duplicateSupplier',
  DUPLICATE_UNIT: 'duplicateUnit',
  DUPLICATE_FAMILY: 'duplicateFamily',
  IMPORTED_FIELD: 'importedField',
}

/** Message to show when a Unit, Family or Supplier write fails. */
export function catalogWriteErrorKind(error: unknown): CatalogWriteErrorKind {
  if (error instanceof ApiError && error.status === 409) return conflictKinds[error.code ?? ''] ?? 'generic'
  return pricesErrorKind(error)
}

/** `NONE` without parameters, `PARTIAL` when imported without the FASAR workbook (FSRs not recomputable), `COMPLETE`. */
export const fasarStatuses = ['NONE', 'PARTIAL', 'COMPLETE'] as const

export type FasarStatus = (typeof fasarStatuses)[number]

/** The twelve contribution concepts, in the order the backend lists them (`docs/pricing.md` §1.10). */
export const fasarConcepts = [
  'RISK',
  'FIXED_FEE',
  'EXCESS_3_UMA',
  'CASH_BENEFITS',
  'PENSIONERS_MEDICAL',
  'DISABILITY_LIFE',
  'RETIREMENT',
  'UNEMPLOYMENT_OLD_AGE',
  'DAYCARE',
  'INFONAVIT',
  'PAYROLL_TAX',
  'OTHER_CHARGES',
] as const

export type FasarConcept = (typeof fasarConcepts)[number]

export const fasarDayFields = [
  'calendar',
  'sundays',
  'workedSundays',
  'vacation',
  'mondays',
  'holidays',
  'weather',
  'custom',
  'leaveSick',
  'union',
  'bonus',
] as const

export type FasarDayField = (typeof fasarDayFields)[number]

const fasarDaysSchema = z.object(Object.fromEntries(fasarDayFields.map((field) => [field, decimalSchema])) as Record<FasarDayField, typeof decimalSchema>)

const fasarContributionSchema = z.object({ concept: z.enum(fasarConcepts), employerRate: decimalSchema, workerRate: decimalSchema })

export type FasarContribution = z.infer<typeof fasarContributionSchema>

/** `FasarResponse` (§2.6); with `status: 'NONE'` every other field is null. `recomputation` only answers a save. */
export const fasarSchema = z.object({
  status: z.enum(fasarStatuses),
  source: z.enum(['FASAR_FILE', 'GENERAL_FIELDS', 'MANUAL']).nullable(),
  version: z.number().int().nullable(),
  year: z.number().int().nullable(),
  uma: decimalSchema.nullable(),
  minimumWage: moneySchema.nullable(),
  sumEmployerAndWorker: z.boolean().nullable(),
  days: fasarDaysSchema.nullable(),
  premiums: z.object({ vacationPct: decimalSchema, sundayPct: decimalSchema, otherChargesPct: decimalSchema }).nullable(),
  caps: z.object({ excessThresholdUma: decimalSchema, sbcCapUma: decimalSchema, factorRounding: z.number().int() }).nullable(),
  contributions: z.array(fasarContributionSchema).nullable(),
  derived: z.object({ tp: decimalSchema, tl: decimalSchema, tpOverTl: decimalSchema, fsbc: decimalSchema }).nullable(),
  laborCategories: z.object({ total: z.number().int(), computed: z.number().int(), mismatches: z.number().int() }).nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.object({ membershipId: z.string().min(1), fullName: z.string() }).nullable(),
  recomputation: z
    .object({ laborCategories: z.number().int(), realWagesChanged: z.number().int(), workItemsRecomputed: z.number().int() })
    .nullable()
    .optional(),
})

export type Fasar = z.infer<typeof fasarSchema>

/** `PUT /fasar`: a full replacement, every field present. Days, rates and premiums are decimal strings. */
export type FasarBody = {
  year: number
  uma: string
  minimumWage: string
  sumEmployerAndWorker: boolean
  days: Record<FasarDayField, string>
  premiums: { vacationPct: string; sundayPct: string; otherChargesPct: string }
  caps: { excessThresholdUma: string; sbcCapUma: string; factorRounding: number }
  contributions: FasarContribution[]
}

function fasarPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/fasar`
}

export function getFasar(organizationId: string): Promise<Fasar> {
  return getJson(fasarPath(organizationId), fasarSchema)
}

/** Replaces the parameters; the server recomputes every Labor category and the derived costs. */
export function replaceFasar(organizationId: string, body: FasarBody): Promise<Fasar> {
  return sendJson('put', fasarPath(organizationId), body, 200, fasarSchema)
}

export type FasarWriteErrorKind = 'importInProgress' | PricesErrorKind

/** Message to show when saving the FASAR parameters fails. */
export function fasarWriteErrorKind(error: unknown): FasarWriteErrorKind {
  if (error instanceof ApiError && error.status === 409 && error.code === 'IMPORT_IN_PROGRESS') return 'importInProgress'
  return pricesErrorKind(error)
}

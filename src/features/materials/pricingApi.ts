import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'

export const materialUnits = ['PIECE', 'BAG', 'SQUARE_METER', 'CUBIC_METER', 'KILOGRAM', 'LITER', 'METER'] as const

export type MaterialUnit = (typeof materialUnits)[number]

export const materialCategories = ['CEMENT_AGGREGATES', 'STEEL', 'WOOD', 'ELECTRICAL', 'PLUMBING', 'FINISHES'] as const

export type MaterialCategory = (typeof materialCategories)[number]

/** Money is a decimal string with two decimals, MXN including IVA. */
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/)

/** `PriceData`: one recorded price, immutable. */
export const observationSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  supplierId: z.string().min(1),
  supplierName: z.string(),
  supplierBranch: z.string().nullable(),
  price: moneySchema,
  observedOn: z.string(),
  sku: z.string().nullable(),
  source: z.enum(['MANUAL', 'CSV']),
  createdAt: z.string(),
})

export type PriceObservation = z.infer<typeof observationSchema>

/** `LatestPrice`: the newest observation of one supplier; `cheapest` marks every entry at the lowest price. */
export const latestPriceSchema = observationSchema.extend({ cheapest: z.boolean() })

export type LatestPrice = z.infer<typeof latestPriceSchema>

/** `MaterialResponse`. `latestPrices` comes ordered cheapest first. */
export const materialSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  unit: z.enum(materialUnits),
  category: z.enum(materialCategories),
  brand: z.string().nullable(),
  archivedAt: z.string().nullable(),
  latestPrices: z.array(latestPriceSchema),
  cheapestSupplierId: z.string().nullable(),
})

export type Material = z.infer<typeof materialSchema>

/** `MaterialDetailResponse`: the material plus every observation, newest first. */
export const materialDetailSchema = materialSchema.extend({ history: z.array(observationSchema) })

export type MaterialDetail = z.infer<typeof materialDetailSchema>

/** `SupplierResponse`: one store or branch. */
export const supplierSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  branch: z.string().nullable(),
  website: z.string().nullable(),
  archivedAt: z.string().nullable(),
})

export type Supplier = z.infer<typeof supplierSchema>

export type MaterialInput = { name: string; unit: MaterialUnit; category: MaterialCategory; brand: string }

export type SupplierInput = { name: string; branch: string; website: string }

export type PriceInput = { materialId: string; supplierId: string; price: string; observedOn: string; sku: string }

export type MaterialFilter = { query?: string; category?: MaterialCategory }

function materialsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/materials`
}

function materialPath(organizationId: string, materialId: string): string {
  return `${materialsPath(organizationId)}/${encodeURIComponent(materialId)}`
}

function suppliersPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/suppliers`
}

function observationsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/price-observations`
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) if (value) search.set(name, value)
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Trimmed text, or undefined when blank so the field is left out of the body. */
function optional(value: string): string | undefined {
  const text = value.trim()
  return text || undefined
}

/** Active materials ordered by name, each with its latest price per supplier. */
export function listMaterials(organizationId: string, filter: MaterialFilter = {}): Promise<Material[]> {
  return getJson(`${materialsPath(organizationId)}${query(filter)}`, z.array(materialSchema))
}

export function getMaterial(organizationId: string, materialId: string): Promise<MaterialDetail> {
  return getJson(materialPath(organizationId, materialId), materialDetailSchema)
}

export function createMaterial(organizationId: string, input: MaterialInput): Promise<Material> {
  const body = { name: input.name.trim(), unit: input.unit, category: input.category, brand: optional(input.brand) }
  return sendJson('post', materialsPath(organizationId), body, 201, materialSchema)
}

/** There is no delete: archiving keeps the history and blocks new prices. */
export function archiveMaterial(organizationId: string, materialId: string): Promise<Material> {
  return sendJson('post', `${materialPath(organizationId, materialId)}/archive`, undefined, 200, materialSchema)
}

/** Active suppliers ordered by name. */
export function listSuppliers(organizationId: string): Promise<Supplier[]> {
  return getJson(suppliersPath(organizationId), z.array(supplierSchema))
}

export function createSupplier(organizationId: string, input: SupplierInput): Promise<Supplier> {
  const body = { name: input.name.trim(), branch: optional(input.branch), website: optional(input.website) }
  return sendJson('post', suppliersPath(organizationId), body, 201, supplierSchema)
}

/** Record a price seen at a supplier. The price goes as the decimal string typed, so no float rounding. */
export function recordPrice(organizationId: string, input: PriceInput): Promise<PriceObservation> {
  const body = {
    materialId: input.materialId,
    supplierId: input.supplierId,
    price: input.price.trim(),
    observedOn: input.observedOn,
    sku: optional(input.sku),
  }
  return sendJson('post', observationsPath(organizationId), body, 201, observationSchema)
}

/** Observations are immutable: a mistake is fixed by deleting it and recording a new one. */
export function deleteObservation(organizationId: string, observationId: string): Promise<void> {
  return deleteJson(`${observationsPath(organizationId)}/${encodeURIComponent(observationId)}`)
}

export type PricingErrorKind =
  | 'duplicateMaterial'
  | 'duplicateSupplier'
  | 'archivedMaterial'
  | 'archivedSupplier'
  | 'invalid'
  | 'session'
  | 'forbidden'
  | 'notFound'
  | 'generic'

const conflictKinds: Record<string, PricingErrorKind> = {
  DUPLICATE_MATERIAL: 'duplicateMaterial',
  DUPLICATE_SUPPLIER: 'duplicateSupplier',
  ARCHIVED_MATERIAL: 'archivedMaterial',
  ARCHIVED_SUPPLIER: 'archivedSupplier',
}

/** Message to show when a pricing request fails; each pricing 409 code has its own. */
export function pricingErrorKind(error: unknown): PricingErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 409) return (error.code && conflictKinds[error.code]) || 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

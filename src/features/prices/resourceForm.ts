import { z } from 'zod'
import { PESOS, type MoneyConversion } from '../../currency'
import { ApiError } from '../../lib/http'
import { amountIssue } from '../sites/budgetRules'
import { pricesErrorKind, type CostEntryBody, type PricesErrorKind, type ResourceCreateBody, type ResourceDetail, type ResourcePatchBody } from './pricesApi'

/** Limits of `docs/pricing.md` §1.5, §1.6: the form never accepts what the server would refuse. */
export const RESOURCE_LIMITS = {
  code: 40,
  name: 160,
  brand: 80,
  description: 10000,
  sku: 64,
  note: 160,
} as const

/** Costs are numeric(14,2): below 10^12 pesos. */
const MAX_COST_MXN = 1e12

export type ResourceValidationMessages = {
  codeRequired: string
  codeMax: string
  nameRequired: string
  nameMax: string
  unitRequired: string
  brandMax: string
  descriptionMax: string
  costRequired: string
  costInvalid: string
  costDecimals: string
  costMax: string
  skuMax: string
  noteMax: string
}

/** The create and edit form; `cost` is only typed when creating. Empty strings mean "none". */
export type ResourceValues = {
  code: string
  name: string
  description: string
  unitId: string
  familyId: string
  supplierId: string
  brand: string
  cost: string
}

export const emptyResourceValues: ResourceValues = {
  code: '',
  name: '',
  description: '',
  unitId: '',
  familyId: '',
  supplierId: '',
  brand: '',
  cost: '',
}

export type CostValues = { amount: string; supplierId: string; sku: string; note: string }

export const emptyCostValues: CostValues = { amount: '', supplierId: '', sku: '', note: '' }

const costMessage = {
  required: 'costRequired',
  invalid: 'costInvalid',
  decimals: 'costDecimals',
  max: 'costMax',
} as const

function costField(messages: ResourceValidationMessages, money: MoneyConversion) {
  return z.string().superRefine((raw, context) => {
    const issue = amountIssue(raw, { allowZero: true, max: MAX_COST_MXN, money })
    if (issue) context.addIssue({ code: 'custom', message: messages[costMessage[issue]] })
  })
}

/** Resource rules as the server applies them; the brand rule per type is enforced by leaving it out. */
export function makeResourceSchema(
  messages: ResourceValidationMessages,
  { withCost, money = PESOS }: { withCost: boolean; money?: MoneyConversion },
) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, messages.codeRequired)
      .max(RESOURCE_LIMITS.code, messages.codeMax),
    name: z.string().trim().min(1, messages.nameRequired).max(RESOURCE_LIMITS.name, messages.nameMax),
    description: z.string().trim().max(RESOURCE_LIMITS.description, messages.descriptionMax),
    unitId: z.string().min(1, messages.unitRequired),
    familyId: z.string(),
    supplierId: z.string(),
    brand: z.string().trim().max(RESOURCE_LIMITS.brand, messages.brandMax),
    cost: withCost ? costField(messages, money) : z.string(),
  })
}

export function makeCostSchema(messages: ResourceValidationMessages, money: MoneyConversion = PESOS) {
  return z.object({
    amount: costField(messages, money),
    supplierId: z.string(),
    sku: z.string().trim().max(RESOURCE_LIMITS.sku, messages.skuMax),
    note: z.string().trim().max(RESOURCE_LIMITS.note, messages.noteMax),
  })
}

function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Typed amount in the picked currency to the pesos string the API takes. */
function pesos(amount: string, money: MoneyConversion): string {
  return money.toMxn(Number(amount.trim())).toFixed(2)
}

/** `POST /resources` body for a simple Material or Equipment rate; only Materials carry a brand. */
export function createResourceBody(
  type: 'MATERIAL' | 'EQUIPMENT',
  values: ResourceValues,
  money: MoneyConversion = PESOS,
): ResourceCreateBody {
  return {
    type,
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    description: orNull(values.description),
    unitId: values.unitId,
    familyId: orNull(values.familyId),
    supplierId: orNull(values.supplierId),
    ...(type === 'MATERIAL' ? { brand: orNull(values.brand) } : {}),
    cost: pesos(values.cost, money),
  }
}

export function resourceValuesFrom(detail: ResourceDetail): ResourceValues {
  return {
    code: detail.code,
    name: detail.name,
    description: detail.description ?? '',
    unitId: detail.unit.id,
    familyId: detail.family?.id ?? '',
    supplierId: detail.supplier?.id ?? '',
    brand: detail.brand ?? '',
    cost: '',
  }
}

/** `PATCH /resources/{id}` body with only what changed; an empty string clears an optional field. */
export function resourcePatchBody(detail: ResourceDetail, values: ResourceValues): ResourcePatchBody {
  const before = resourceValuesFrom(detail)
  const body: ResourcePatchBody = {}
  const name = values.name.trim()
  if (name !== before.name) body.name = name
  const description = values.description.trim()
  if (description !== before.description) body.description = description
  if (values.unitId !== before.unitId) body.unitId = values.unitId
  if (values.familyId !== before.familyId) body.familyId = values.familyId
  if (values.supplierId !== before.supplierId) body.supplierId = values.supplierId
  const brand = values.brand.trim()
  if (detail.type === 'MATERIAL' && brand !== before.brand) body.brand = brand
  return body
}

export function costBody(values: CostValues, money: MoneyConversion = PESOS): CostEntryBody {
  return {
    amount: pesos(values.amount, money),
    supplierId: orNull(values.supplierId),
    sku: orNull(values.sku),
    note: orNull(values.note),
  }
}

export type ResourceWriteErrorKind =
  | 'duplicateCode'
  | 'archivedUnit'
  | 'archivedFamily'
  | 'archivedSupplier'
  | 'archivedResource'
  | PricesErrorKind

const conflictKinds: Record<string, ResourceWriteErrorKind> = {
  DUPLICATE_CODE: 'duplicateCode',
  ARCHIVED_UNIT: 'archivedUnit',
  ARCHIVED_FAMILY: 'archivedFamily',
  ARCHIVED_SUPPLIER: 'archivedSupplier',
  ARCHIVED_RESOURCE: 'archivedResource',
}

/** Message to show when creating, editing, archiving or recording a cost fails. */
export function resourceWriteErrorKind(error: unknown): ResourceWriteErrorKind {
  if (error instanceof ApiError && error.status === 409) return conflictKinds[error.code ?? ''] ?? 'generic'
  return pricesErrorKind(error)
}

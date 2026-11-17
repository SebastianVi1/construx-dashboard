import { z } from 'zod'
import type { FieldConfig } from '../../components/form'
import { PESOS, type Currency, type MoneyConversion } from '../../currency'
import type { Messages } from '../../i18n'
import { formatMessage } from '../../i18n/format'
import { ApiError } from '../../lib/http'
import { amountIssue } from '../sites/budgetRules'
import {
  pricesErrorKind,
  type CostEntryBody,
  type LaborWageBody,
  type PricesErrorKind,
  type ResourceCreateBody,
  type ResourceDetail,
  type ResourcePatchBody,
} from './pricesApi'

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

export type LaborValidationMessages = {
  wageRequired: string
  wageInvalid: string
  wageDecimals: string
  wageMax: string
  fsrRequired: string
  fsrRange: string
  fsrDecimals: string
}

/** The wage form of a Labor category; money in the picked currency, empty benefits mean zero. */
export type LaborValues = {
  nominalWage: string
  fsr: string
  perDiem: string
  mealsLodging: string
  funeralExpenses: string
  otherBenefits: string
}

export const emptyLaborValues: LaborValues = {
  nominalWage: '',
  fsr: '',
  perDiem: '',
  mealsLodging: '',
  funeralExpenses: '',
  otherBenefits: '',
}

export const benefitFields = ['perDiem', 'mealsLodging', 'funeralExpenses', 'otherBenefits'] as const

/** Daily amounts are numeric(12,2): below 10^10 pesos. */
const MAX_WAGE_MXN = 1e10

const FSR_DECIMALS = 8

const wageMessage = {
  required: 'wageRequired',
  invalid: 'wageInvalid',
  decimals: 'wageDecimals',
  max: 'wageMax',
} as const

function wageField(messages: LaborValidationMessages, money: MoneyConversion, required: boolean) {
  return z.string().superRefine((raw, context) => {
    if (!required && raw.trim() === '') return
    const issue = amountIssue(raw, { allowZero: true, max: MAX_WAGE_MXN, money })
    if (issue) context.addIssue({ code: 'custom', message: messages[wageMessage[issue]] })
  })
}

/** The FSR typed by hand: from 1 to 3 with up to eight decimals (`docs/pricing.md` §2.4). */
function fsrField(messages: LaborValidationMessages) {
  return z.string().superRefine((raw, context) => {
    const value = raw.trim()
    if (value === '') {
      context.addIssue({ code: 'custom', message: messages.fsrRequired })
      return
    }
    if (!/^\d+(\.\d+)?$/.test(value) || Number(value) < 1 || Number(value) > 3) {
      context.addIssue({ code: 'custom', message: messages.fsrRange })
      return
    }
    if ((value.split('.')[1] ?? '').replace(/0+$/, '').length > FSR_DECIMALS) {
      context.addIssue({ code: 'custom', message: messages.fsrDecimals })
    }
  })
}

export function makeLaborSchema(messages: LaborValidationMessages, money: MoneyConversion = PESOS) {
  return z.object({
    nominalWage: wageField(messages, money, true),
    fsr: fsrField(messages),
    perDiem: wageField(messages, money, false),
    mealsLodging: wageField(messages, money, false),
    funeralExpenses: wageField(messages, money, false),
    otherBenefits: wageField(messages, money, false),
  })
}

/** Cents of a typed amount, or null when it is not a number. */
function cents(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return 0
  const number = Number(trimmed)
  return Number.isFinite(number) ? Math.round(number * 100) : null
}

/**
 * The real wage the server will compute, in the same currency as the typed amounts:
 * `round(nominalWage x FSR, 2)` plus the four daily benefits. Null until wage and FSR are numbers.
 */
export function realWagePreview(values: LaborValues): string | null {
  if (values.nominalWage.trim() === '' || values.fsr.trim() === '') return null
  const wage = cents(values.nominalWage)
  const fsr = Number(values.fsr.trim())
  if (wage === null || !Number.isFinite(fsr)) return null
  // Cents x FSR rounded half-up; FSR has at most eight decimals, so scale it to an integer first.
  const scaledFsr = Math.round(fsr * 1e8)
  const product = Math.round((wage * scaledFsr) / 1e8 + 1e-9)
  let total = product
  for (const field of benefitFields) {
    const benefit = cents(values[field])
    if (benefit === null) return null
    total += benefit
  }
  return (total / 100).toFixed(2)
}

/** Wage fields of a Labor category, shared by the create form and this dialog. */
export function laborFields(w: Messages['prices']['write'], currency: Currency): FieldConfig[] {
  return [
    { name: 'nominalWage', label: formatMessage(w.field.nominalWage, { currency }), type: 'money', placeholder: w.field.amountPlaceholder },
    { name: 'fsr', label: w.field.fsr, type: 'number', decimals: 8, maxDigits: 1, hint: w.field.fsrHint, placeholder: '1.7' },
    ...benefitFields.map(
      (name): FieldConfig => ({
        name,
        label: formatMessage(w.field[name], { currency }),
        type: 'money',
        placeholder: w.field.amountPlaceholder,
        hint: w.field.benefitHint,
      }),
    ),
  ]
}

/** Typed FSR as the API takes it: trimmed, without trailing zeros. */
function factor(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes('.') ? trimmed.replace(/0+$/, '').replace(/\.$/, '') : trimmed
}

function laborWageBody(values: LaborValues, money: MoneyConversion): LaborWageBody {
  const benefit = (raw: string) => (raw.trim() === '' ? '0.00' : pesos(raw, money))
  return {
    nominalWage: pesos(values.nominalWage, money),
    fsr: factor(values.fsr),
    perDiem: benefit(values.perDiem),
    mealsLodging: benefit(values.mealsLodging),
    funeralExpenses: benefit(values.funeralExpenses),
    otherBenefits: benefit(values.otherBenefits),
  }
}

/** `POST /resources` body for a Labor category: no cost and no brand, the wage instead. */
export function createLaborBody(values: ResourceValues, wage: LaborValues, money: MoneyConversion = PESOS): Extract<ResourceCreateBody, { type: 'LABOR' }> {
  return {
    type: 'LABOR',
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    description: orNull(values.description),
    unitId: values.unitId,
    familyId: orNull(values.familyId),
    supplierId: orNull(values.supplierId),
    laborDetail: laborWageBody(wage, money),
  }
}

/** The wage form filled with a Labor category's stored wage (in pesos). */
export function laborValuesFrom(detail: ResourceDetail): LaborValues {
  const labor = detail.laborDetail
  if (!labor) return emptyLaborValues
  return {
    nominalWage: labor.nominalWage,
    fsr: labor.fsr,
    perDiem: labor.perDiem,
    mealsLodging: labor.mealsLodging,
    funeralExpenses: labor.funeralExpenses,
    otherBenefits: labor.otherBenefits,
  }
}

/**
 * `PATCH` body with only the wage fields whose value changed; `{}` when nothing did. `shown` is the form as it
 * was filled (amounts in the picked currency), so an untouched amount is never re-sent with conversion drift.
 * A category without wage yet always sends its nominal wage and FSR.
 */
export function laborPatchBody(
  detail: ResourceDetail,
  values: LaborValues,
  money: MoneyConversion = PESOS,
  shown: LaborValues = laborValuesFrom(detail),
): ResourcePatchBody {
  const next = laborWageBody(values, money)
  const changed: Partial<LaborWageBody> = {}
  const differs = (field: keyof LaborValues) => Number(values[field].trim() || '0') !== Number(shown[field].trim() || '0')
  if (!detail.laborDetail || differs('nominalWage')) changed.nominalWage = next.nominalWage
  if (!detail.laborDetail || differs('fsr')) changed.fsr = next.fsr
  for (const field of benefitFields) {
    if (differs(field)) changed[field] = next[field]
  }
  return Object.keys(changed).length === 0 ? {} : { laborDetail: changed }
}

/** `POST /resources` body for a simple Material or Equipment rate; only Materials carry a brand. */
export function createResourceBody(
  type: 'MATERIAL' | 'EQUIPMENT',
  values: ResourceValues,
  money: MoneyConversion = PESOS,
): Extract<ResourceCreateBody, { cost: string }> {
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
  | 'derivedCost'
  | 'laborCostFromWage'
  | PricesErrorKind

const conflictKinds: Record<string, ResourceWriteErrorKind> = {
  DUPLICATE_CODE: 'duplicateCode',
  ARCHIVED_UNIT: 'archivedUnit',
  ARCHIVED_FAMILY: 'archivedFamily',
  ARCHIVED_SUPPLIER: 'archivedSupplier',
  ARCHIVED_RESOURCE: 'archivedResource',
  DERIVED_COST: 'derivedCost',
  LABOR_COST_FROM_WAGE: 'laborCostFromWage',
}

/** Message to show when creating, editing, archiving or recording a cost fails. */
export function resourceWriteErrorKind(error: unknown): ResourceWriteErrorKind {
  if (error instanceof ApiError && error.status === 409) return conflictKinds[error.code ?? ''] ?? 'generic'
  return pricesErrorKind(error)
}

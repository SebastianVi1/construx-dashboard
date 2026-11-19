import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'
import { ApiError } from '../../lib/http'
import type { Resource, ResourceQuery, ResourceType } from '../prices/pricesApi'
import { siteErrorKind, type SiteErrorKind } from '../sites/sitesApi'
import type { CatalogExpenseDraft, Expense, ExpenseCategory, ExpensePatch } from './financeApi'

/** The Resource types an expense can be charged from; Work items cannot (docs/pricing.md §6.5). */
export const expensableTypes = ['MATERIAL', 'EQUIPMENT', 'LABOR'] as const

export type ExpensableType = (typeof expensableTypes)[number]

export type CatalogExpenseValidationMessages = {
  resourceRequired: string
  quantityRequired: string
  quantityInvalid: string
  quantityDecimals: string
  quantityMax: string
  dateRequired: string
  descriptionMax: string
}

export type CatalogExpenseValues = {
  resourceId: string
  quantity: string
  spentOn: string
  description: string
}

export type QuantityIssue = 'required' | 'invalid' | 'decimals' | 'max'

const quantityMessage = {
  required: 'quantityRequired',
  invalid: 'quantityInvalid',
  decimals: 'quantityDecimals',
  max: 'quantityMax',
} as const

const QUANTITY_DECIMALS = 6
/** numeric(18,6): twelve digits before the dot. */
const QUANTITY_DIGITS = 12

export function categoryOfResource(type: ExpensableType): ExpenseCategory {
  return type === 'MATERIAL' ? 'MATERIALS' : type
}

export function isFromCatalog(expense: Expense): boolean {
  return expense.resource != null
}

/** Above 0, digits and a dot, up to 6 decimals and 12 integer digits, as the backend stores it. */
export function quantityIssue(raw: string): QuantityIssue | null {
  const value = raw.trim()
  if (!value) return 'required'
  if (!/^\d+(\.\d+)?$/.test(value) || Number(value) === 0) return 'invalid'
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > QUANTITY_DECIMALS) return 'decimals'
  if (whole.replace(/^0+/, '').length > QUANTITY_DIGITS) return 'max'
  return null
}

/** A non-negative decimal string as an integer count of `10^-scale`, or null when it is not one. */
function scaled(raw: string, scale: number): bigint | null {
  const value = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > scale) return null
  return BigInt(whole + fraction.padEnd(scale, '0'))
}

/**
 * `round2(quantity × unitCost)` computed exactly, half up, as the backend does; null while the quantity is not a
 * valid number or the Resource has no cost.
 */
export function catalogAmount(quantity: string, unitCost: string | null | undefined): number | null {
  if (unitCost == null) return null
  const q = scaled(quantity, QUANTITY_DECIMALS)
  const cost = scaled(unitCost, 2)
  if (q === null || cost === null) return null
  const cents = (q * cost + 500_000n) / 1_000_000n
  return Number(cents) / 100
}

export type CatalogPreview = { kind: 'amount'; amount: number } | { kind: 'pending' } | { kind: 'onSave' }

/**
 * What the dialog says about the amount: the computed amount for a caller who sees prices, "enter a quantity" while
 * it cannot be computed, and for everyone else that the server computes it from the current catalog cost on save.
 */
export function catalogPreview(quantity: string, unitCost: string | null | undefined, seePrices: boolean): CatalogPreview {
  if (!seePrices) return { kind: 'onSave' }
  const amount = catalogAmount(quantity, unitCost)
  return amount === null ? { kind: 'pending' } : { kind: 'amount', amount }
}

/** Why a Resource cannot be charged, or null when it can. */
export function unpickableReason(resource: Resource): 'notExpensable' | 'archived' | 'noCost' | null {
  if (!(expensableTypes as readonly string[]).includes(resource.type)) return 'notExpensable'
  if (resource.archivedAt) return 'archived'
  if (resource.currentCost == null) return 'noCost'
  return null
}

export type ExpenseErrorKind = SiteErrorKind | 'archived' | 'noCost'

/** The catalog refusals of §6.5 by their code; everything else as the other site writes. */
export function expenseErrorKind(error: unknown): ExpenseErrorKind {
  if (error instanceof ApiError && error.code === 'ARCHIVED_RESOURCE') return 'archived'
  if (error instanceof ApiError && error.code === 'RESOURCE_WITHOUT_COST') return 'noCost'
  return siteErrorKind(error)
}

/** The picker's search: one type, by text, first twenty by code. Archived Resources are left out by default. */
export function pickerQuery(type: ResourceType, text: string): ResourceQuery {
  return { types: [type], query: text.trim(), sort: { field: 'code', direction: 'asc' }, page: 0, size: 20 }
}

export function makeCatalogExpenseSchema(messages: CatalogExpenseValidationMessages) {
  return z.object({
    resourceId: z.string().min(1, messages.resourceRequired),
    quantity: z.string().superRefine((raw, context) => {
      const issue = quantityIssue(raw)
      if (issue) context.addIssue({ code: 'custom', message: messages[quantityMessage[issue]] })
    }),
    spentOn: z.string().min(1, messages.dateRequired),
    description: z.string().trim().max(TEXT_LIMITS.expenseDescription, messages.descriptionMax),
  })
}

/** The create body; an empty concept is left out so the backend uses the Resource name. */
export function buildCatalogExpenseDraft(values: CatalogExpenseValues): CatalogExpenseDraft {
  const description = values.description.trim()
  return {
    resourceId: values.resourceId,
    quantity: values.quantity.trim(),
    spentOn: values.spentOn,
    ...(description ? { description } : {}),
  }
}

export function catalogExpenseToValues(expense: Expense): CatalogExpenseValues {
  return {
    resourceId: expense.resource?.id ?? '',
    quantity: expense.quantity ?? '',
    spentOn: expense.spentOn,
    description: expense.description,
  }
}

/** Only the date and the concept can change; `{}` means nothing to save. */
export function buildCatalogExpensePatch(expense: Expense, values: CatalogExpenseValues): ExpensePatch {
  const patch: ExpensePatch = {}
  const description = values.description.trim()
  if (values.spentOn !== expense.spentOn) patch.spentOn = values.spentOn
  if (description && description !== expense.description) patch.description = description
  return patch
}

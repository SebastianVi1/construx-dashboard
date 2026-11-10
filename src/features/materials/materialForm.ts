import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'
import { PESOS, type MoneyConversion } from '../../currency'
import { amountIssue } from '../sites/budgetRules'
import { materialCategories, materialUnits } from './pricingApi'

/** Picker value that means "create a new supplier with the fields below". */
export const NEW_SUPPLIER = '__new__'

export type MaterialValidationMessages = {
  nameRequired: string
  nameMax: string
  unitRequired: string
  categoryRequired: string
  brandMax: string
}

export type PriceValidationMessages = {
  materialRequired: string
  supplierRequired: string
  supplierNameRequired: string
  supplierNameMax: string
  branchMax: string
  websiteInvalid: string
  priceInvalid: string
  priceDecimals: string
  priceMax: string
  dateRequired: string
  dateFuture: string
  skuMax: string
}

export type MaterialValues = { name: string; unit: string; category: string; brand: string }

export type PriceValues = {
  materialId: string
  supplierId: string
  supplierName: string
  supplierBranch: string
  supplierWebsite: string
  price: string
  observedOn: string
  sku: string
}

/** Material rules, within the backend's: a name, unit and category, and an optional brand. */
export function makeMaterialSchema(messages: MaterialValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(TEXT_LIMITS.materialName, messages.nameMax),
    unit: z.string().refine((value) => (materialUnits as readonly string[]).includes(value), messages.unitRequired),
    category: z
      .string()
      .refine((value) => (materialCategories as readonly string[]).includes(value), messages.categoryRequired),
    brand: z.string().trim().max(TEXT_LIMITS.brand, messages.brandMax),
  })
}

/** Below 10^10 pesos: numeric(12,2) on the backend. */
const MAX_PRICE_MXN = 1e10

const priceMessage = {
  required: 'priceInvalid',
  invalid: 'priceInvalid',
  decimals: 'priceDecimals',
  max: 'priceMax',
} as const

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
  } catch {
    return false
  }
}

/**
 * Price rules, mirroring the backend: a price > 0 with at most two decimals that
 * fits numeric(12,2) once converted to pesos, an observed date that is not after
 * `today` (local date, which is never ahead of the server's UTC date in Mexico),
 * and a supplier. A new supplier needs a name; its branch and website (http or
 * https) are optional.
 */
export function makePriceSchema(messages: PriceValidationMessages, today: string, money: MoneyConversion = PESOS) {
  return z
    .object({
      materialId: z.string().min(1, messages.materialRequired),
      supplierId: z.string().min(1, messages.supplierRequired),
      supplierName: z.string(),
      supplierBranch: z.string(),
      supplierWebsite: z.string(),
      price: z.string().superRefine((raw, context) => {
        const issue = amountIssue(raw, { allowZero: false, max: MAX_PRICE_MXN, money })
        if (issue) context.addIssue({ code: 'custom', message: messages[priceMessage[issue]] })
      }),
      observedOn: z.string().superRefine((value, context) => {
        if (!value) context.addIssue({ code: 'custom', message: messages.dateRequired })
        else if (value > today) context.addIssue({ code: 'custom', message: messages.dateFuture })
      }),
      sku: z.string().trim().max(TEXT_LIMITS.sku, messages.skuMax),
    })
    .superRefine((values, context) => {
      if (values.supplierId !== NEW_SUPPLIER) return
      const name = values.supplierName.trim()
      if (!name) context.addIssue({ code: 'custom', path: ['supplierName'], message: messages.supplierNameRequired })
      else if (name.length > TEXT_LIMITS.supplierName) {
        context.addIssue({ code: 'custom', path: ['supplierName'], message: messages.supplierNameMax })
      }
      if (values.supplierBranch.trim().length > TEXT_LIMITS.supplierBranch) {
        context.addIssue({ code: 'custom', path: ['supplierBranch'], message: messages.branchMax })
      }
      const website = values.supplierWebsite.trim()
      if (website && (website.length > TEXT_LIMITS.supplierWebsite || !isWebUrl(website))) {
        context.addIssue({ code: 'custom', path: ['supplierWebsite'], message: messages.websiteInvalid })
      }
    })
}

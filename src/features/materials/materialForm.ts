import { z } from 'zod'
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

/** Material rules, mirroring the backend: name 1..160, unit and category required, brand up to 80. */
export function makeMaterialSchema(messages: MaterialValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax),
    unit: z.string().refine((value) => (materialUnits as readonly string[]).includes(value), messages.unitRequired),
    category: z
      .string()
      .refine((value) => (materialCategories as readonly string[]).includes(value), messages.categoryRequired),
    brand: z.string().trim().max(80, messages.brandMax),
  })
}

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
 * fits numeric(12,2), an observed date that is not after `today` (local date,
 * which is never ahead of the server's UTC date in Mexico), and a supplier. A new
 * supplier needs a name; its branch and website (http or https) are optional.
 */
export function makePriceSchema(messages: PriceValidationMessages, today: string) {
  return z
    .object({
      materialId: z.string().min(1, messages.materialRequired),
      supplierId: z.string().min(1, messages.supplierRequired),
      supplierName: z.string(),
      supplierBranch: z.string(),
      supplierWebsite: z.string(),
      price: z.string().superRefine((raw, context) => {
        const value = raw.trim()
        if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) {
          context.addIssue({ code: 'custom', message: messages.priceInvalid })
        } else if (!/^\d+(\.\d{1,2})?$/.test(value)) {
          context.addIssue({ code: 'custom', message: messages.priceDecimals })
        } else if (Number(value) >= 1e10) {
          context.addIssue({ code: 'custom', message: messages.priceMax })
        }
      }),
      observedOn: z.string().superRefine((value, context) => {
        if (!value) context.addIssue({ code: 'custom', message: messages.dateRequired })
        else if (value > today) context.addIssue({ code: 'custom', message: messages.dateFuture })
      }),
      sku: z.string().trim().max(64, messages.skuMax),
    })
    .superRefine((values, context) => {
      if (values.supplierId !== NEW_SUPPLIER) return
      const name = values.supplierName.trim()
      if (!name) context.addIssue({ code: 'custom', path: ['supplierName'], message: messages.supplierNameRequired })
      else if (name.length > 160) {
        context.addIssue({ code: 'custom', path: ['supplierName'], message: messages.supplierNameMax })
      }
      if (values.supplierBranch.trim().length > 120) {
        context.addIssue({ code: 'custom', path: ['supplierBranch'], message: messages.branchMax })
      }
      const website = values.supplierWebsite.trim()
      if (website && (website.length > 255 || !isWebUrl(website))) {
        context.addIssue({ code: 'custom', path: ['supplierWebsite'], message: messages.websiteInvalid })
      }
    })
}

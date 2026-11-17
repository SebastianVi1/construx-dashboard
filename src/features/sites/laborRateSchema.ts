import { z } from 'zod'

const moneySchema = z.string().regex(/^\d+\.\d{2}$/)

export const laborRateKinds = ['CATALOG', 'FIXED', 'NONE'] as const

export type LaborRateKind = (typeof laborRateKinds)[number]

/** The catalog Labor category behind a CATALOG rate; `realWage` is its current cost. */
export const laborCategorySchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  realWage: moneySchema.nullable(),
})

export type LaborCategoryRef = z.infer<typeof laborCategorySchema>

/**
 * `LaborRate` (docs/pricing.md §6.1). `dailyAmount` is the amount in force now: the category's current cost for
 * CATALOG, the fixed amount for FIXED, null for NONE.
 */
export const laborRateSchema = z.object({
  kind: z.enum(laborRateKinds),
  laborCategory: laborCategorySchema.nullable(),
  dailyAmount: moneySchema.nullable(),
  effectiveFrom: z.string(),
  setBy: z.object({ membershipId: z.string().min(1), fullName: z.string().nullable() }),
})

export type LaborRate = z.infer<typeof laborRateSchema>

import { z } from 'zod'
import { getJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'

/** Longest range the accrual reads, both ends included (docs/pricing.md §6.3). */
export const MAX_LABOR_RANGE_DAYS = 366

export const unratedReasons = ['NO_RATE', 'NO_COST_YET'] as const
export type UnratedReason = (typeof unratedReasons)[number]

/**
 * A Labor rate as the accrual shows it. `dailyAmount` (money string) is that day's amount, or today's for a
 * current rate; null for `NONE` and for a category without a cost.
 */
export const accrualRateSchema = z.object({
  kind: z.enum(['CATALOG', 'FIXED', 'NONE']),
  laborCategory: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  dailyAmount: z.string().nullable(),
})

export type AccrualRate = z.infer<typeof accrualRateSchema>

const personCostSchema = z.object({
  membershipId: z.string(),
  fullName: z.string().nullable(),
  days: z.number(),
  amount: z.string(),
  unratedDays: z.number(),
  currentRate: accrualRateSchema.nullable(),
})

export type PersonCost = z.infer<typeof personCostSchema>

/** `GET /labor-cost`: the Site's Accrued labor cost over a range, per person (VIEW_BUDGET). */
export const laborCostReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  total: z.string(),
  personDays: z.number(),
  unratedPersonDays: z.number(),
  people: z.array(personCostSchema),
})

export type LaborCostReport = z.infer<typeof laborCostReportSchema>

const laborCostDaySchema = z.object({
  day: z.string(),
  membershipId: z.string(),
  fullName: z.string().nullable(),
  rate: accrualRateSchema.nullable(),
  amount: z.string(),
  unrated: z.boolean(),
  unratedReason: z.enum(unratedReasons).nullable(),
})

export type LaborCostDay = z.infer<typeof laborCostDaySchema>

export const laborCostDayPageSchema = z.object({
  content: z.array(laborCostDaySchema),
  page: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
})

export type LaborCostDayPage = z.infer<typeof laborCostDayPageSchema>

/** `YYYY-MM-DD` ends; an empty one leaves the server default (first Check-in day, today). */
export type LaborRange = { from?: string; to?: string }

export type LaborDaysQuery = LaborRange & { membershipId?: string; page?: number; size?: number }

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getLaborCost(organizationId: string, siteId: string, range: LaborRange = {}): Promise<LaborCostReport> {
  return getJson(
    `${sitePath(organizationId, siteId)}/labor-cost${query({ from: range.from, to: range.to })}`,
    laborCostReportSchema,
  )
}

/** Per person per day, newest day first, then by name. */
export function listLaborCostDays(
  organizationId: string,
  siteId: string,
  params: LaborDaysQuery = {},
): Promise<LaborCostDayPage> {
  const search = query({
    membershipId: params.membershipId,
    from: params.from,
    to: params.to,
    page: params.page,
    size: params.size,
  })
  return getJson(`${sitePath(organizationId, siteId)}/labor-cost/days${search}`, laborCostDayPageSchema)
}

export type LaborRangeIssue = 'order' | 'tooLong'

/** Checks a picked range before asking: the start after the end, or more than 366 days. */
export function laborRangeIssue(from: string, to: string): LaborRangeIssue | null {
  if (!from || !to) return null
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  if (start > end) return 'order'
  const days = Math.round((end - start) / 86_400_000) + 1
  return days > MAX_LABOR_RANGE_DAYS ? 'tooLong' : null
}

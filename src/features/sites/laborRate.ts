import { z } from 'zod'
import { ApiError, getJson, sendJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'
import { laborRateSchema, type LaborCategoryRef, type LaborRateKind } from './laborRateSchema'
import { siteAccessSchema, type SiteAccess } from './sitesApi'

export { laborRateKinds, laborRateSchema, type LaborCategoryRef, type LaborRate, type LaborRateKind } from './laborRateSchema'

/** `GET .../access/{accessId}/labor-rate`: current rate, the one from another site to pre-fill, history newest first. */
export const laborRateViewSchema = z.object({
  current: laborRateSchema.nullable(),
  suggested: laborRateSchema.extend({ fromProject: z.object({ id: z.string().min(1), name: z.string() }).nullable() }).nullable(),
  history: z.array(laborRateSchema),
})

export type LaborRateView = z.infer<typeof laborRateViewSchema>

export type LaborRateBody =
  | { kind: 'CATALOG'; laborCategoryId: string }
  | { kind: 'FIXED'; dailyAmount: string }
  | { kind: 'NONE' }

/** The rate editor's values; `amount` as typed. `suggestedFrom` names the site the pre-fill came from. */
export type LaborRateDraft = {
  kind: LaborRateKind
  category: LaborCategoryRef | null
  amount: string
  suggestedFrom: string | null
}

function laborRatePath(organizationId: string, siteId: string, accessId: string): string {
  return `${sitePath(organizationId, siteId)}/access/${encodeURIComponent(accessId)}/labor-rate`
}

export function getLaborRate(organizationId: string, siteId: string, accessId: string): Promise<LaborRateView> {
  return getJson(laborRatePath(organizationId, siteId, accessId), laborRateViewSchema)
}

/** Sets the rate effective now (MANAGE_PROJECT); returns the access with its new rate. */
export function setLaborRate(organizationId: string, siteId: string, accessId: string, body: LaborRateBody): Promise<SiteAccess> {
  return sendJson('put', laborRatePath(organizationId, siteId, accessId), body, 200, siteAccessSchema)
}

/** The editor starts from the current rate, else from the latest rate on another site, else an empty catalog pick. */
export function laborRateDraft(view: LaborRateView): LaborRateDraft {
  const source = view.current ?? view.suggested
  if (!source) return { kind: 'CATALOG', category: null, amount: '', suggestedFrom: null }
  return {
    kind: source.kind,
    category: source.kind === 'CATALOG' ? source.laborCategory : null,
    amount: source.kind === 'FIXED' ? (source.dailyAmount ?? '') : '',
    suggestedFrom: view.current ? null : (view.suggested?.fromProject?.name ?? null),
  }
}

export type LaborRateDraftError = 'category' | 'amount'

/** The PUT body, or which field is missing or wrong. Amounts are zero or more with at most two decimals. */
export function laborRateBody(draft: LaborRateDraft): { ok: true; body: LaborRateBody } | { ok: false; error: LaborRateDraftError } {
  if (draft.kind === 'NONE') return { ok: true, body: { kind: 'NONE' } }
  if (draft.kind === 'CATALOG') {
    return draft.category ? { ok: true, body: { kind: 'CATALOG', laborCategoryId: draft.category.id } } : { ok: false, error: 'category' }
  }
  const amount = draft.amount.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return { ok: false, error: 'amount' }
  return { ok: true, body: { kind: 'FIXED', dailyAmount: Number(amount).toFixed(2) } }
}

export type LaborRateErrorKind = 'invalid' | 'session' | 'forbidden' | 'notFound' | 'generic'

/** Message to show when reading or setting a rate fails. */
export function laborRateErrorKind(error: unknown): LaborRateErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}

import { z } from 'zod'
import { sitePath } from '../../lib/apiPaths'
import { getJson } from '../../lib/http'
import { pageSchema, resourceTypes, type Page } from '../prices/pricesApi'
import type { LaborCategoryRef } from './laborRateSchema'

/**
 * What a Resource is picked for (backend docs/pricing.md §6.7): a Labor category for a Labor rate (MANAGE_PROJECT)
 * or a Resource for an expense from the catalog (MANAGE_BUDGET or a task Lead). Neither needs VIEW_PRICES.
 */
export type CatalogLookupPurpose = 'LABOR_RATE' | 'EXPENSE'

/** A Resource as the site lookup lists it: code and name, never a cost. Unknown keys are dropped. */
export const catalogLookupItemSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  type: z.enum(resourceTypes),
  unitCode: z.string(),
})

export type CatalogLookupItem = z.infer<typeof catalogLookupItemSchema>

const LOOKUP_SIZE = 20

/** The first twenty matches by code; a blank search lists everything. */
export function lookupCatalog(
  organizationId: string,
  siteId: string,
  purpose: CatalogLookupPurpose,
  text: string,
): Promise<Page<CatalogLookupItem>> {
  const params = new URLSearchParams({ purpose })
  const query = text.trim()
  if (query) params.set('query', query)
  params.set('page', '0')
  params.set('size', String(LOOKUP_SIZE))
  return getJson(`${sitePath(organizationId, siteId)}/catalog-lookup?${params}`, pageSchema(catalogLookupItemSchema))
}

/** The rate editor's pick; the wage is unknown here and the server answers it once the rate is saved. */
export function laborCategoryFromLookup(item: CatalogLookupItem): LaborCategoryRef {
  return { id: item.id, code: item.code, name: item.name, realWage: null }
}

import { PAGE_SIZE, type Cost, type Page, type ResourceQuery, type ResourceSort, type ResourceSortField, type ResourceType } from './pricesApi'

export type PriceTabKey = 'materials' | 'labor' | 'equipment' | 'workItems' | 'suppliers' | 'import'

/** A tab of the Prices screen; `type` is the Resource type it lists, null for the non-catalog tabs. */
export type PriceTab = { key: PriceTabKey; type: ResourceType | null; enabled: boolean }

/** Display order. Only the Materials and Equipment lists exist so far; the rest say "coming soon". */
export const priceTabs: PriceTab[] = [
  { key: 'materials', type: 'MATERIAL', enabled: true },
  { key: 'labor', type: 'LABOR', enabled: false },
  { key: 'equipment', type: 'EQUIPMENT', enabled: true },
  { key: 'workItems', type: 'WORK_ITEM', enabled: false },
  { key: 'suppliers', type: null, enabled: false },
  { key: 'import', type: null, enabled: false },
]

/** Filter controls as the form holds them; empty strings mean "any". */
export type PriceFilters = {
  query: string
  familyId: string
  unitId: string
  supplierId: string
  includeArchived: boolean
  discontinued: '' | 'yes' | 'no'
}

export const emptyFilters: PriceFilters = { query: '', familyId: '', unitId: '', supplierId: '', includeArchived: false, discontinued: '' }

/** The server orders by code ascending when no sort is sent. */
const DEFAULT_SORT: ResourceSort = { field: 'code', direction: 'asc' }

/** Clicking a column header: ascending, then descending, then back to the default order. */
export function nextSort(current: ResourceSort | undefined, field: ResourceSortField): ResourceSort | undefined {
  const active = current ?? DEFAULT_SORT
  if (active.field !== field) return { field, direction: 'asc' }
  if (active.direction === 'asc') return { field, direction: 'desc' }
  return field === DEFAULT_SORT.field ? DEFAULT_SORT : undefined
}

/** The sort in effect, for marking the active column header. */
export function effectiveSort(current: ResourceSort | undefined): ResourceSort {
  return current ?? DEFAULT_SORT
}

export type PageRange = { from: number; to: number; total: number; hasPrevious: boolean; hasNext: boolean }

/** "101–120 of 120" and whether there are pages around this one. */
export function pageRange(page: Pick<Page<unknown>, 'page' | 'size' | 'totalElements' | 'totalPages'>): PageRange {
  const from = page.totalElements === 0 ? 0 : page.page * page.size + 1
  const to = Math.min((page.page + 1) * page.size, page.totalElements)
  return { from, to, total: page.totalElements, hasPrevious: page.page > 0, hasNext: page.page + 1 < page.totalPages }
}

export function resourceQueryFor(type: ResourceType, filters: PriceFilters, sort: ResourceSort | undefined, page: number): ResourceQuery {
  return {
    types: [type],
    query: filters.query.trim() || undefined,
    familyId: filters.familyId || undefined,
    unitId: filters.unitId || undefined,
    supplierId: filters.supplierId || undefined,
    includeArchived: filters.includeArchived,
    discontinued: filters.discontinued === '' ? null : filters.discontinued === 'yes',
    sort,
    page,
    size: PAGE_SIZE,
  }
}

/** Who recorded a cost: the person, the import that wrote it, or nobody known (converted old prices). */
export function costAuthor(cost: Pick<Cost, 'recordedBy' | 'importId'>, labels: { import: string; unknown: string }): string {
  if (cost.recordedBy) return cost.recordedBy.fullName
  if (cost.importId) return labels.import
  return labels.unknown
}

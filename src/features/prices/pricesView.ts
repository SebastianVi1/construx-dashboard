import { PAGE_SIZE, type AnalysisLine, type Cost, type Page, type Resource, type ResourceQuery, type ResourceSort, type ResourceSortField, type ResourceType } from './pricesApi'

export type PriceTabKey = 'materials' | 'labor' | 'equipment' | 'workItems' | 'suppliers' | 'import'

/** A tab of the Prices screen; `type` is the Resource type it lists, null for the non-catalog tabs. */
export type PriceTab = { key: PriceTabKey; type: ResourceType | null; enabled: boolean }

/** Display order. The four catalog lists and Suppliers exist; Import says "coming soon". */
export const priceTabs: PriceTab[] = [
  { key: 'materials', type: 'MATERIAL', enabled: true },
  { key: 'labor', type: 'LABOR', enabled: true },
  { key: 'equipment', type: 'EQUIPMENT', enabled: true },
  { key: 'workItems', type: 'WORK_ITEM', enabled: true },
  { key: 'suppliers', type: null, enabled: true },
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
  /** Labor tab only: `yes` Gangs, `no` Labor categories. */
  composite: '' | 'yes' | 'no'
}

export const emptyFilters: PriceFilters = {
  query: '',
  familyId: '',
  unitId: '',
  supplierId: '',
  includeArchived: false,
  discontinued: '',
  composite: '',
}

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
    composite: filters.composite === '' ? null : filters.composite === 'yes',
    sort,
    page,
    size: PAGE_SIZE,
  }
}

export type ResourceActions = { edit: boolean; recordCost: boolean; editWage: boolean; archive: boolean }

/**
 * What someone with MANAGE_PRICES can do from the detail: every Resource can be edited; only an active simple
 * Material or Equipment rate takes a hand-recorded cost (composites are derived), and an active simple Labor
 * category changes its cost through its wage.
 */
export function resourceActions(resource: Pick<Resource, 'type' | 'isComposite' | 'archivedAt'>): ResourceActions {
  const active = resource.archivedAt === null
  const handCosted = !resource.isComposite && (resource.type === 'MATERIAL' || resource.type === 'EQUIPMENT')
  const wage = !resource.isComposite && resource.type === 'LABOR'
  return { edit: true, recordCost: active && handCosted, editWage: active && wage, archive: active }
}

export type AnalysisLineLabel = { kind: 'consumption' | 'output' | 'percentage'; value: string }

/**
 * How to read the quantity of an analysis line: a consumption per unit (`*`), an output per day (`/`), or for a
 * percentage Resource a share of the labor subtotal shown in percent.
 */
export function analysisLineLabel(line: Pick<AnalysisLine, 'operator' | 'quantity'> & { component: Pick<AnalysisLine['component'], 'isPercentage'> }): AnalysisLineLabel {
  if (line.component.isPercentage) return { kind: 'percentage', value: fractionToPercent(line.quantity) }
  return { kind: line.operator === '/' ? 'output' : 'consumption', value: line.quantity }
}

/** `"0.03"` -> `"3"` without floating-point noise. */
export function fractionToPercent(fraction: string): string {
  const [whole, decimals = ''] = fraction.replace('-', '').split('.')
  const digits = (whole + decimals.padEnd(2, '0')).replace(/^0+(?=\d)/, '')
  const point = digits.length - Math.max(decimals.length - 2, 0)
  const integer = digits.slice(0, point) || '0'
  const rest = digits.slice(point).replace(/0+$/, '')
  return (fraction.startsWith('-') ? '-' : '') + (rest ? `${integer}.${rest}` : integer)
}

/** Who recorded a cost: the person, the import that wrote it, or nobody known (converted old prices). */
export function costAuthor(cost: Pick<Cost, 'recordedBy' | 'importId'>, labels: { import: string; unknown: string }): string {
  if (cost.recordedBy) return cost.recordedBy.fullName
  if (cost.importId) return labels.import
  return labels.unknown
}

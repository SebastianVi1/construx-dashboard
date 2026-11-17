/**
 * What the Prices screen shows, as plain data: the tab, the filters, the sort
 * and the page. It round-trips through the URL (so a reload keeps it) and
 * builds the `GET /resources` query string. No React here.
 */

/** Resource types of the catalog (Neodata Tipo 1 to 4). */
export const resourceTypes = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'WORK_ITEM'] as const

export type ResourceType = (typeof resourceTypes)[number]

/** Tabs of the Prices screen, in display order. */
export const pricesTabs = ['materials', 'labor', 'equipment', 'workItems', 'suppliers', 'import'] as const

export type PricesTab = (typeof pricesTabs)[number]

const tabTypes: Record<PricesTab, ResourceType | null> = {
  materials: 'MATERIAL',
  labor: 'LABOR',
  equipment: 'EQUIPMENT',
  workItems: 'WORK_ITEM',
  suppliers: null,
  import: null,
}

const activeTabs: ReadonlySet<PricesTab> = new Set(['materials', 'equipment'])

/** The resource type a tab lists; null for the tabs that are not a resource table. */
export function tabResourceType(tab: PricesTab): ResourceType | null {
  return tabTypes[tab]
}

export function tabForType(type: ResourceType): PricesTab {
  return pricesTabs.find((tab) => tabTypes[tab] === type) ?? 'materials'
}

/** Whether a tab can be opened yet; the rest show "Coming soon". */
export function isTabActive(tab: PricesTab): boolean {
  return activeTabs.has(tab)
}

/** Sort fields `GET /resources` accepts. */
export const sortFields = ['code', 'name', 'currentCost', 'costUpdatedAt'] as const

export type SortField = (typeof sortFields)[number]

export type SortDir = 'asc' | 'desc'

export type ResourceSort = { field: SortField; dir: SortDir }

/** The server's default order. */
export const defaultSort: ResourceSort = { field: 'code', dir: 'asc' }

/** Costs and dates are read highest or newest first; codes and names A to Z. */
const firstDir: Record<SortField, SortDir> = { code: 'asc', name: 'asc', currentCost: 'desc', costUpdatedAt: 'desc' }

/** Clicking a header: the same column flips its direction, another column starts in its natural one. */
export function toggleSort(current: ResourceSort, field: SortField): ResourceSort {
  if (current.field === field) return { field, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { field, dir: firstDir[field] }
}

/** Discontinued resources: both (the server's default), only them, or none of them. */
export const discontinuedChoices = ['all', 'only', 'none'] as const

export type DiscontinuedChoice = (typeof discontinuedChoices)[number]

export type ResourceFilters = {
  /** Contains over code, name and description; blank means no search. */
  query: string
  familyId: string
  unitId: string
  supplierId: string
  includeArchived: boolean
  discontinued: DiscontinuedChoice
}

export const noFilters: ResourceFilters = {
  query: '',
  familyId: '',
  unitId: '',
  supplierId: '',
  includeArchived: false,
  discontinued: 'all',
}

/** Rows per page of the resources table. */
export const PAGE_SIZE = 50

export type ResourcesRequest = { types: readonly ResourceType[]; filters: ResourceFilters; sort: ResourceSort; page: number }

/** Query string of `GET /resources`: unset filters are left out so the server's defaults apply. */
export function resourcesQueryString({ types, filters, sort, page }: ResourcesRequest): string {
  const search = new URLSearchParams()
  for (const type of types) search.append('type', type)
  const query = filters.query.trim()
  if (query) search.set('query', query)
  if (filters.familyId) search.set('familyId', filters.familyId)
  if (filters.unitId) search.set('unitId', filters.unitId)
  if (filters.supplierId) search.set('supplierId', filters.supplierId)
  if (filters.includeArchived) search.set('includeArchived', 'true')
  if (filters.discontinued !== 'all') search.set('discontinued', String(filters.discontinued === 'only'))
  search.set('page', String(page))
  search.set('size', String(PAGE_SIZE))
  search.set('sort', `${sort.field},${sort.dir}`)
  return `?${search.toString()}`
}

/** Everything the Prices screen shows; `page` is zero-based like the API. */
export type PricesView = { tab: PricesTab; filters: ResourceFilters; sort: ResourceSort; page: number }

export const defaultView: PricesView = { tab: 'materials', filters: noFilters, sort: defaultSort, page: 0 }

function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  return values.find((candidate) => candidate === value)
}

function readSort(value: string | null): ResourceSort {
  const [field, dir] = (value ?? '').split(',')
  const sortField = oneOf(sortFields, field)
  const sortDir = oneOf(['asc', 'desc'] as const, dir)
  return sortField && sortDir ? { field: sortField, dir: sortDir } : defaultSort
}

/** The view a URL search describes; anything unknown falls back to its default. */
export function parsePricesSearch(search: URLSearchParams): PricesView {
  const tab = oneOf(pricesTabs, search.get('tab'))
  const page = Number(search.get('page'))
  return {
    tab: tab && isTabActive(tab) ? tab : defaultView.tab,
    filters: {
      query: search.get('q') ?? '',
      familyId: search.get('family') ?? '',
      unitId: search.get('unit') ?? '',
      supplierId: search.get('supplier') ?? '',
      includeArchived: search.get('archived') === '1',
      discontinued: oneOf(discontinuedChoices, search.get('discontinued')) ?? 'all',
    },
    sort: readSort(search.get('sort')),
    // The URL counts pages from 1, as people do.
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  }
}

/** The URL search of a view, `''` for the default one; defaults are left out. */
export function pricesSearchString(view: PricesView): string {
  const search = new URLSearchParams()
  const { tab, filters, sort, page } = view
  if (tab !== defaultView.tab) search.set('tab', tab)
  if (filters.query) search.set('q', filters.query)
  if (filters.familyId) search.set('family', filters.familyId)
  if (filters.unitId) search.set('unit', filters.unitId)
  if (filters.supplierId) search.set('supplier', filters.supplierId)
  if (filters.includeArchived) search.set('archived', '1')
  if (filters.discontinued !== 'all') search.set('discontinued', filters.discontinued)
  if (sort.field !== defaultSort.field || sort.dir !== defaultSort.dir) search.set('sort', `${sort.field},${sort.dir}`)
  if (page > 0) search.set('page', String(page + 1))
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** A filter change shows its first page again. */
export function withFilters(view: PricesView, change: Partial<ResourceFilters>): PricesView {
  return { ...view, filters: { ...view.filters, ...change }, page: 0 }
}

/** Whether any filter narrows the list, to tell "nothing matches" from "nothing yet". */
export function hasFilters(filters: ResourceFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.familyId !== '' ||
    filters.unitId !== '' ||
    filters.supplierId !== '' ||
    filters.includeArchived ||
    filters.discontinued !== 'all'
  )
}

/** Guard for a select value: one of the known discontinued choices. */
export function isDiscontinuedChoice(value: string): value is DiscontinuedChoice {
  return oneOf(discontinuedChoices, value) !== undefined
}

/** Route that opens a Resource's drawer over the list; add the list's search to keep its state. */
export function resourceRoute(resourceId: string): string {
  return `/prices/${encodeURIComponent(resourceId)}`
}

/** DOM id of a tab, referenced by its panel's `aria-labelledby`. */
export function tabId(tab: PricesTab): string {
  return `prices-tab-${tab}`
}

/** DOM id of a tab's panel, referenced by the tab's `aria-controls`. */
export function panelId(tab: PricesTab): string {
  return `prices-panel-${tab}`
}

import { describe, expect, it } from 'bun:test'
import {
  defaultSort,
  defaultView,
  hasFilters,
  isTabActive,
  noFilters,
  parsePricesSearch,
  pricesSearchString,
  pricesTabs,
  resourcesQueryString,
  tabForType,
  tabResourceType,
  toggleSort,
  withFilters,
  discontinuedChoices,
  isDiscontinuedChoice,
  panelId,
  resourceRoute,
  tabId,
} from '../../../features/prices/resourceQuery'

describe('prices tabs', () => {
  it('lists the six tabs in display order', () => {
    expect(pricesTabs).toEqual(['materials', 'labor', 'equipment', 'workItems', 'suppliers', 'import'])
  })

  it('maps each resource tab to its type and back', () => {
    expect(tabResourceType('materials')).toBe('MATERIAL')
    expect(tabResourceType('labor')).toBe('LABOR')
    expect(tabResourceType('equipment')).toBe('EQUIPMENT')
    expect(tabResourceType('workItems')).toBe('WORK_ITEM')
    expect(tabForType('EQUIPMENT')).toBe('equipment')
    expect(tabForType('WORK_ITEM')).toBe('workItems')
  })

  it('has no resource type for the suppliers and import tabs', () => {
    expect(tabResourceType('suppliers')).toBeNull()
    expect(tabResourceType('import')).toBeNull()
  })

  it('opens only materials and equipment in this release', () => {
    expect(pricesTabs.filter(isTabActive)).toEqual(['materials', 'equipment'])
  })
})

describe('toggleSort', () => {
  it('flips the direction when the same column is clicked again', () => {
    expect(toggleSort({ field: 'code', dir: 'asc' }, 'code')).toEqual({ field: 'code', dir: 'desc' })
    expect(toggleSort({ field: 'code', dir: 'desc' }, 'code')).toEqual({ field: 'code', dir: 'asc' })
  })

  it('starts text columns ascending and cost and date columns descending', () => {
    expect(toggleSort({ field: 'code', dir: 'asc' }, 'name')).toEqual({ field: 'name', dir: 'asc' })
    expect(toggleSort({ field: 'code', dir: 'asc' }, 'currentCost')).toEqual({ field: 'currentCost', dir: 'desc' })
    expect(toggleSort({ field: 'name', dir: 'desc' }, 'costUpdatedAt')).toEqual({ field: 'costUpdatedAt', dir: 'desc' })
  })
})

describe('resourcesQueryString', () => {
  it('sends only the type, page, size and default sort when nothing is filtered', () => {
    expect(resourcesQueryString({ types: ['MATERIAL'], filters: noFilters, sort: defaultSort, page: 0 })).toBe(
      '?type=MATERIAL&page=0&size=50&sort=code%2Casc',
    )
  })

  it('repeats type and sends every filter that is set', () => {
    const query = resourcesQueryString({
      types: ['MATERIAL', 'EQUIPMENT'],
      filters: {
        query: '  cemento gris ',
        familyId: 'f-1',
        unitId: 'u-1',
        supplierId: 's-1',
        includeArchived: true,
        discontinued: 'only',
      },
      sort: { field: 'currentCost', dir: 'desc' },
      page: 3,
    })
    expect(query).toBe(
      '?type=MATERIAL&type=EQUIPMENT&query=cemento+gris&familyId=f-1&unitId=u-1&supplierId=s-1' +
        '&includeArchived=true&discontinued=true&page=3&size=50&sort=currentCost%2Cdesc',
    )
  })

  it('asks for discontinued=false when discontinued resources are hidden', () => {
    const query = resourcesQueryString({ types: ['EQUIPMENT'], filters: { ...noFilters, discontinued: 'none' }, sort: defaultSort, page: 0 })
    expect(query).toBe('?type=EQUIPMENT&discontinued=false&page=0&size=50&sort=code%2Casc')
  })
})

describe('prices view in the URL', () => {
  it('reads an empty search as the first page of materials by code', () => {
    expect(parsePricesSearch(new URLSearchParams(''))).toEqual(defaultView)
    expect(defaultView).toEqual({ tab: 'materials', filters: noFilters, sort: defaultSort, page: 0 })
  })

  it('writes nothing for the default view, so /prices stays clean', () => {
    expect(pricesSearchString(defaultView)).toBe('')
  })

  it('writes a filtered view with a one-based page and reads it back', () => {
    const view = {
      tab: 'equipment' as const,
      filters: { query: 'revolvedora', familyId: 'f-1', unitId: 'u-1', supplierId: 's-1', includeArchived: true, discontinued: 'none' as const },
      sort: { field: 'costUpdatedAt' as const, dir: 'desc' as const },
      page: 2,
    }
    const text = pricesSearchString(view)
    expect(text).toBe(
      '?tab=equipment&q=revolvedora&family=f-1&unit=u-1&supplier=s-1&archived=1&discontinued=none&sort=costUpdatedAt%2Cdesc&page=3',
    )
    expect(parsePricesSearch(new URLSearchParams(text))).toEqual(view)
  })

  it('falls back to the defaults for values it does not know', () => {
    const view = parsePricesSearch(new URLSearchParams('tab=nope&sort=price,up&discontinued=maybe&page=-4&archived=yes'))
    expect(view).toEqual(defaultView)
  })

  it('opens materials when the URL names a tab that is not available yet', () => {
    expect(parsePricesSearch(new URLSearchParams('tab=labor')).tab).toBe('materials')
  })

  it('goes back to the first page when a filter changes', () => {
    const view = { ...defaultView, page: 4 }
    expect(withFilters(view, { familyId: 'f-2' })).toEqual({ ...view, filters: { ...noFilters, familyId: 'f-2' }, page: 0 })
  })
})

describe('hasFilters', () => {
  it('tells an empty catalog from a search that found nothing', () => {
    expect(hasFilters(noFilters)).toBe(false)
    expect(hasFilters({ ...noFilters, query: '   ' })).toBe(false)
    expect(hasFilters({ ...noFilters, query: 'arena' })).toBe(true)
    expect(hasFilters({ ...noFilters, discontinued: 'none' })).toBe(true)
    expect(hasFilters({ ...noFilters, includeArchived: true })).toBe(true)
  })
})


describe('prices URL validation', () => {
  it.each(['1.5', '2.5', 'abc', 'NaN', 'Infinity', '-1', '0'])(
    'falls back to page zero for invalid page %s',
    (page) => {
      expect(parsePricesSearch(new URLSearchParams({ page })).page).toBe(0)
    },
  )

  it.each(['price,asc', 'code,up', '', 'name,'])('falls back for invalid sort %s', (sort) => {
    expect(parsePricesSearch(new URLSearchParams({ sort })).sort).toEqual(defaultSort)
  })

  it('omits whitespace-only query and unset optional filters without losing false', () => {
    const search = new URLSearchParams(resourcesQueryString({
      types: [], filters: { ...noFilters, query: '   ', discontinued: 'none' },
      sort: { field: 'name', dir: 'desc' }, page: 0,
    }))
    expect([...search.entries()]).toEqual([
      ['discontinued', 'false'], ['page', '0'], ['size', '50'], ['sort', 'name,desc'],
    ])
  })

  it('round-trips punctuation and unicode in a non-default view', () => {
    const view = {
      ...defaultView, tab: 'equipment' as const, page: 3,
      filters: { ...noFilters, query: 'Río & arena + 50%', supplierId: 'supplier/1', discontinued: 'only' as const },
      sort: { field: 'currentCost' as const, dir: 'desc' as const },
    }
    expect(parsePricesSearch(new URLSearchParams(pricesSearchString(view)))).toEqual(view)
  })
})

describe('prices routes and ids', () => {
  it('builds the drawer route of a resource with its id encoded', () => {
    expect(resourceRoute('r-1')).toBe('/prices/r-1')
    expect(resourceRoute('r/1 ?')).toBe('/prices/r%2F1%20%3F')
  })

  it('pairs each tab with its panel for the ARIA wiring', () => {
    expect(tabId('equipment')).toBe('prices-tab-equipment')
    expect(panelId('equipment')).toBe('prices-panel-equipment')
  })

  it('accepts only the known discontinued choices', () => {
    expect(discontinuedChoices.filter(isDiscontinuedChoice)).toEqual(['all', 'only', 'none'])
    expect(isDiscontinuedChoice('maybe')).toBe(false)
    expect(isDiscontinuedChoice('')).toBe(false)
  })
})

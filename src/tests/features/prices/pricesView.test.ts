import { describe, expect, it } from 'bun:test'
import { costAuthor, nextSort, pageRange, priceTabs, resourceQueryFor, type PriceFilters } from '../../../features/prices/pricesView'

const filters: PriceFilters = { query: '', familyId: '', unitId: '', supplierId: '', includeArchived: false, discontinued: '' }

describe('priceTabs', () => {
  it('lists the six tabs in order, only Materials and Equipment active', () => {
    expect(priceTabs.map((tab) => [tab.key, tab.type, tab.enabled])).toEqual([
      ['materials', 'MATERIAL', true],
      ['labor', 'LABOR', false],
      ['equipment', 'EQUIPMENT', true],
      ['workItems', 'WORK_ITEM', false],
      ['suppliers', null, false],
      ['import', null, false],
    ])
  })
})

describe('nextSort', () => {
  it('starts a new column ascending, flips the same column, and goes back to the default after descending', () => {
    expect(nextSort(undefined, 'name')).toEqual({ field: 'name', direction: 'asc' })
    expect(nextSort({ field: 'name', direction: 'asc' }, 'name')).toEqual({ field: 'name', direction: 'desc' })
    expect(nextSort({ field: 'name', direction: 'desc' }, 'name')).toBeUndefined()
    expect(nextSort({ field: 'name', direction: 'desc' }, 'currentCost')).toEqual({ field: 'currentCost', direction: 'asc' })
  })

  it('treats the default code order as code ascending', () => {
    expect(nextSort(undefined, 'code')).toEqual({ field: 'code', direction: 'desc' })
  })
})

describe('pageRange', () => {
  it('gives the first and last row shown and the total', () => {
    expect(pageRange({ page: 0, size: 50, totalElements: 120, totalPages: 3 })).toEqual({ from: 1, to: 50, total: 120, hasPrevious: false, hasNext: true })
    expect(pageRange({ page: 2, size: 50, totalElements: 120, totalPages: 3 })).toEqual({ from: 101, to: 120, total: 120, hasPrevious: true, hasNext: false })
  })

  it('shows zero rows for an empty result', () => {
    expect(pageRange({ page: 0, size: 50, totalElements: 0, totalPages: 0 })).toEqual({ from: 0, to: 0, total: 0, hasPrevious: false, hasNext: false })
  })
})

describe('resourceQueryFor', () => {
  it('asks for the tab type and leaves out empty filters', () => {
    expect(resourceQueryFor('MATERIAL', filters, undefined, 0)).toEqual({
      types: ['MATERIAL'],
      query: undefined,
      familyId: undefined,
      unitId: undefined,
      supplierId: undefined,
      includeArchived: false,
      discontinued: null,
      sort: undefined,
      page: 0,
      size: 50,
    })
  })

  it('maps the discontinued choice and keeps the sort and page', () => {
    const query = resourceQueryFor(
      'EQUIPMENT',
      { ...filters, query: 'revolvedora', familyId: 'f-1', discontinued: 'yes', includeArchived: true },
      { field: 'currentCost', direction: 'desc' },
      3,
    )
    expect(query).toMatchObject({
      types: ['EQUIPMENT'],
      query: 'revolvedora',
      familyId: 'f-1',
      includeArchived: true,
      discontinued: true,
      sort: { field: 'currentCost', direction: 'desc' },
      page: 3,
    })
    expect(resourceQueryFor('MATERIAL', { ...filters, discontinued: 'no' }, undefined, 0).discontinued).toBe(false)
  })
})

describe('costAuthor', () => {
  it('names who recorded the cost, or the import, or nobody', () => {
    const labels = { import: 'Import', unknown: '—' }
    expect(costAuthor({ recordedBy: { membershipId: 'm-1', fullName: 'Ana López' }, importId: null }, labels)).toBe('Ana López')
    expect(costAuthor({ recordedBy: null, importId: 'i-1' }, labels)).toBe('Import')
    expect(costAuthor({ recordedBy: null, importId: null }, labels)).toBe('—')
  })
})

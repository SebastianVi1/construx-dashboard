import { describe, expect, it } from 'bun:test'
import { messages } from '../../../i18n/messages'
import {
  buildCatalogExpenseDraft,
  buildCatalogExpensePatch,
  catalogAmount,
  catalogExpenseToValues,
  expenseErrorKind,
  categoryOfResource,
  isFromCatalog,
  makeCatalogExpenseSchema,
  pickerQuery,
  unpickableReason,
} from '../../../features/finance/catalogExpense'
import type { Expense } from '../../../features/finance/financeApi'
import { ApiError } from '../../../lib/http'
import type { Resource } from '../../../features/prices/pricesApi'

const v = messages.en.finance.validation
const valid = { resourceId: 'r-1', quantity: '12.5', spentOn: '2026-11-14', description: '' }
const typed: Expense = {
  id: 'e-1',
  projectId: 'p-1',
  amount: 50,
  spentOn: '2026-10-01',
  description: 'Permit',
  category: 'OTHER',
}
const fromCatalog: Expense = {
  ...typed,
  amount: 3068.75,
  description: 'Cemento gris 50 kg',
  category: 'MATERIALS',
  resource: { id: 'r-1', code: 'MAN-CEM-001', name: 'Cemento gris 50 kg', type: 'MATERIAL', unitCode: 'SACO' },
  quantity: '12.5',
  unitCost: '245.50',
}
const cement: Resource = {
  id: 'r-1',
  code: 'MAN-CEM-001',
  type: 'MATERIAL',
  name: 'Cemento gris 50 kg',
  unit: { id: 'u-1', code: 'SACO' },
  family: null,
  supplier: null,
  brand: null,
  isPercentage: false,
  isComposite: false,
  isHourlyCost: false,
  discontinued: false,
  currentCost: '245.50',
  costUpdatedAt: '2026-11-15T18:02:11Z',
  source: 'MANUAL',
  missingFromImportAt: null,
  archivedAt: null,
}

function errorsOf(values: typeof valid) {
  const result = makeCatalogExpenseSchema(v).safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => [issue.path[0], issue.message])
}

describe('expense from the catalog', () => {
  it('computes the amount as round2(quantity × unit cost) without float drift', () => {
    expect(catalogAmount('12.5', '245.50')).toBe(3068.75)
    expect(catalogAmount('0.333333', '612.40')).toBe(204.13)
    expect(catalogAmount('3', '0.10')).toBe(0.3)
    expect(catalogAmount('1.005', '1.00')).toBe(1.01)
    expect(catalogAmount('', '245.50')).toBeNull()
    expect(catalogAmount('abc', '245.50')).toBeNull()
    expect(catalogAmount('2', null)).toBeNull()
  })

  it('deduces the category from the resource type', () => {
    expect(categoryOfResource('MATERIAL')).toBe('MATERIALS')
    expect(categoryOfResource('EQUIPMENT')).toBe('EQUIPMENT')
    expect(categoryOfResource('LABOR')).toBe('LABOR')
  })

  it('needs a resource, a quantity above 0 with up to 6 decimals and a date; the concept is optional', () => {
    expect(errorsOf(valid)).toEqual([])
    expect(errorsOf({ ...valid, resourceId: '' })).toEqual([['resourceId', v.resourceRequired]])
    expect(errorsOf({ ...valid, quantity: '' })).toEqual([['quantity', v.quantityRequired]])
    expect(errorsOf({ ...valid, quantity: '0' })).toEqual([['quantity', v.quantityInvalid]])
    expect(errorsOf({ ...valid, quantity: '-1' })).toEqual([['quantity', v.quantityInvalid]])
    expect(errorsOf({ ...valid, quantity: '1.0000001' })).toEqual([['quantity', v.quantityDecimals]])
    expect(errorsOf({ ...valid, quantity: '1000000000000' })).toEqual([['quantity', v.quantityMax]])
    expect(errorsOf({ ...valid, spentOn: '' })).toEqual([['spentOn', v.dateRequired]])
    expect(errorsOf({ ...valid, description: 'x'.repeat(161) })).toEqual([['description', v.descriptionMax]])
  })

  it('sends the resource and quantity, and leaves the concept out when empty so the resource name is used', () => {
    expect(buildCatalogExpenseDraft(valid)).toEqual({ resourceId: 'r-1', quantity: '12.5', spentOn: '2026-11-14' })
    expect(buildCatalogExpenseDraft({ ...valid, quantity: ' 3 ', description: ' Twelve bags ' })).toEqual({
      resourceId: 'r-1',
      quantity: '3',
      spentOn: '2026-11-14',
      description: 'Twelve bags',
    })
  })

  it('edits only the date and the concept of an expense from the catalog', () => {
    expect(isFromCatalog(fromCatalog)).toBe(true)
    expect(isFromCatalog(typed)).toBe(false)
    const values = catalogExpenseToValues(fromCatalog)
    expect(values).toEqual({ resourceId: 'r-1', quantity: '12.5', spentOn: '2026-10-01', description: 'Cemento gris 50 kg' })
    expect(buildCatalogExpensePatch(fromCatalog, values)).toEqual({})
    expect(buildCatalogExpensePatch(fromCatalog, { ...values, quantity: '99', spentOn: '2026-10-02', description: ' Bags ' }))
      .toEqual({ spentOn: '2026-10-02', description: 'Bags' })
  })

  it('offers only resources with a cost that are not archived', () => {
    expect(unpickableReason(cement)).toBeNull()
    expect(unpickableReason({ ...cement, currentCost: null })).toBe('noCost')
    expect(unpickableReason({ ...cement, archivedAt: '2026-11-15T00:00:00Z' })).toBe('archived')
    expect(unpickableReason({ ...cement, type: 'WORK_ITEM' })).toBe('notExpensable')
  })

  it('names the catalog refusals and falls back to the site errors', () => {
    expect(expenseErrorKind(new ApiError(409, undefined, 'ARCHIVED_RESOURCE'))).toBe('archived')
    expect(expenseErrorKind(new ApiError(400, undefined, 'RESOURCE_WITHOUT_COST'))).toBe('noCost')
    expect(expenseErrorKind(new ApiError(403))).toBe('forbidden')
    expect(expenseErrorKind(new Error('boom'))).toBe('generic')
  })

  it('searches one resource type by text', () => {
    expect(pickerQuery('LABOR', ' albañil ')).toEqual({
      types: ['LABOR'],
      query: 'albañil',
      sort: { field: 'code', direction: 'asc' },
      page: 0,
      size: 20,
    })
  })
})

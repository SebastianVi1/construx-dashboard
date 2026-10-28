import { describe, expect, it } from 'bun:test'
import { collectErrors } from '../../components/form'
import { NEW_SUPPLIER, makeMaterialSchema, makePriceSchema, type PriceValues } from './materialForm'

const messages = {
  nameRequired: 'name required',
  nameMax: 'name too long',
  unitRequired: 'unit required',
  categoryRequired: 'category required',
  brandMax: 'brand too long',
  materialRequired: 'material required',
  supplierRequired: 'supplier required',
  supplierNameRequired: 'supplier name required',
  supplierNameMax: 'supplier name too long',
  branchMax: 'branch too long',
  websiteInvalid: 'website invalid',
  priceInvalid: 'price invalid',
  priceDecimals: 'two decimals',
  priceMax: 'price too high',
  dateRequired: 'date required',
  dateFuture: 'date in future',
  skuMax: 'sku too long',
}

const today = '2026-10-27'
const valid: PriceValues = {
  materialId: 'm-1',
  supplierId: 's-1',
  supplierName: '',
  supplierBranch: '',
  supplierWebsite: '',
  price: '245.50',
  observedOn: today,
  sku: '',
}

function priceErrors(values: Partial<PriceValues>) {
  const result = makePriceSchema(messages, today).safeParse({ ...valid, ...values })
  return result.success ? {} : collectErrors(result.error)
}

function materialErrors(values: Record<string, string>) {
  const result = makeMaterialSchema(messages).safeParse({ name: 'Cemento', unit: 'BAG', category: 'STEEL', brand: '', ...values })
  return result.success ? {} : collectErrors(result.error)
}

describe('material form', () => {
  it('accepts a material with name, unit and category and no brand', () => {
    expect(materialErrors({})).toEqual({})
  })

  it('requires a name, a unit and a category', () => {
    expect(materialErrors({ name: '  ', unit: '', category: '' })).toEqual({
      name: 'name required',
      unit: 'unit required',
      category: 'category required',
    })
  })

  it('limits the name to 160 and the brand to 80 characters', () => {
    expect(materialErrors({ name: 'a'.repeat(161), brand: 'b'.repeat(81) })).toEqual({
      name: 'name too long',
      brand: 'brand too long',
    })
  })
})

describe('price form', () => {
  it('accepts a valid price with an existing supplier', () => {
    expect(priceErrors({})).toEqual({})
  })

  it('requires a material and a supplier', () => {
    expect(priceErrors({ materialId: '', supplierId: '' })).toEqual({
      materialId: 'material required',
      supplierId: 'supplier required',
    })
  })

  it('price must be greater than zero', () => {
    expect(priceErrors({ price: '0' }).price).toBe('price invalid')
    expect(priceErrors({ price: '-3' }).price).toBe('price invalid')
    expect(priceErrors({ price: 'abc' }).price).toBe('price invalid')
    expect(priceErrors({ price: '' }).price).toBe('price invalid')
  })

  it('price has at most two decimals', () => {
    expect(priceErrors({ price: '245.505' }).price).toBe('two decimals')
    expect(priceErrors({ price: '245.5' })).toEqual({})
    expect(priceErrors({ price: ' 245 ' })).toEqual({})
  })

  it('price fits numeric(12,2)', () => {
    expect(priceErrors({ price: '10000000000' }).price).toBe('price too high')
    expect(priceErrors({ price: '9999999999.99' })).toEqual({})
  })

  it('observedOn is required and cannot be after today', () => {
    expect(priceErrors({ observedOn: '' }).observedOn).toBe('date required')
    expect(priceErrors({ observedOn: '2026-10-28' }).observedOn).toBe('date in future')
    expect(priceErrors({ observedOn: '2026-01-01' })).toEqual({})
  })

  it('limits the sku to 64 characters', () => {
    expect(priceErrors({ sku: 'x'.repeat(65) }).sku).toBe('sku too long')
  })

  it('a new supplier needs a name; branch and website are optional', () => {
    expect(priceErrors({ supplierId: NEW_SUPPLIER })).toEqual({ supplierName: 'supplier name required' })
    expect(priceErrors({ supplierId: NEW_SUPPLIER, supplierName: 'Home Depot' })).toEqual({})
  })

  it('a new supplier website must be an http or https URL', () => {
    const base = { supplierId: NEW_SUPPLIER, supplierName: 'Home Depot' }
    expect(priceErrors({ ...base, supplierWebsite: 'homedepot.com.mx' }).supplierWebsite).toBe('website invalid')
    expect(priceErrors({ ...base, supplierWebsite: 'ftp://homedepot.com.mx' }).supplierWebsite).toBe('website invalid')
    expect(priceErrors({ ...base, supplierWebsite: 'https://www.homedepot.com.mx' })).toEqual({})
  })

  it('a new supplier name and branch have length limits', () => {
    expect(priceErrors({ supplierId: NEW_SUPPLIER, supplierName: 'a'.repeat(161), supplierBranch: 'b'.repeat(121) })).toEqual({
      supplierName: 'supplier name too long',
      supplierBranch: 'branch too long',
    })
  })

  it('ignores the new supplier fields when an existing supplier is picked', () => {
    expect(priceErrors({ supplierName: 'a'.repeat(200), supplierWebsite: 'nope' })).toEqual({})
  })
})

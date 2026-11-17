import { describe, expect, it } from 'bun:test'
import {
  makeListItemSchema,
  makeSupplierSchema,
  supplierCreateBody,
  supplierFormValues,
  supplierPatchBody,
  type CatalogValidationMessages,
} from '../../../features/prices/catalogForms'
import type { Supplier } from '../../../features/prices/pricesApi'

const messages: CatalogValidationMessages = {
  codeRequired: 'code required',
  codeMax: 'code max',
  nameRequired: 'name required',
  nameMax: 'name max',
  textMax: 'too long',
  websiteInvalid: 'website',
  emailInvalid: 'email',
  rfcInvalid: 'rfc',
}

const imported: Supplier = {
  id: 's-1',
  name: 'VARIOS',
  branch: null,
  website: null,
  code: 'NEO-7',
  rfc: null,
  address: null,
  neighborhood: null,
  city: 'Puebla',
  state: null,
  postalCode: null,
  phone: '222 111',
  mobile: null,
  fax: null,
  email: null,
  contact: null,
  notes: null,
  isDefault: true,
  source: 'NEODATA_CONSTRUBASE',
  archivedAt: null,
  resourceCount: 10,
}

describe('supplier form', () => {
  it('starts empty for a new supplier and from the stored values for an edit', () => {
    const fresh = supplierFormValues()
    expect(fresh.name).toBe('')
    expect(fresh.isDefault).toBe('[]')
    const edit = supplierFormValues(imported)
    expect(edit.code).toBe('NEO-7')
    expect(edit.city).toBe('Puebla')
    expect(edit.mobile).toBe('')
    expect(edit.isDefault).toBe('["default"]')
  })

  it('create body trims, leaves blanks out and sends the default flag', () => {
    const values = { ...supplierFormValues(), name: '  Depot ', code: ' p1 ', email: ' ', isDefault: '["default"]' }
    expect(supplierCreateBody(values)).toEqual({ name: 'Depot', code: 'p1', isDefault: true })
  })

  it('patch body sends only changed fields, an empty string for a cleared one, never the code of an imported supplier', () => {
    const values = { ...supplierFormValues(imported), phone: '', contact: ' Luis ', code: 'OTHER', isDefault: '[]' }
    expect(supplierPatchBody(values, imported)).toEqual({ phone: '', contact: 'Luis', isDefault: false })
    const manual = { ...imported, source: 'MANUAL' as const }
    expect(supplierPatchBody({ ...supplierFormValues(manual), code: '' }, manual)).toEqual({ code: '' })
    expect(supplierPatchBody(supplierFormValues(manual), manual)).toEqual({})
  })

  it('validates name, website, email and RFC', () => {
    const schema = makeSupplierSchema(messages)
    const ok = { ...supplierFormValues(), name: 'Depot' }
    expect(schema.safeParse(ok).success).toBe(true)
    const issues = (values: Record<string, string>) =>
      (schema.safeParse(values).error?.issues ?? []).map((issue) => issue.message)
    expect(issues({ ...ok, name: ' ' })).toEqual(['name required'])
    expect(issues({ ...ok, website: 'depot.mx' })).toEqual(['website'])
    expect(issues({ ...ok, email: 'nope' })).toEqual(['email'])
    expect(issues({ ...ok, rfc: 'ABCDEFGHIJKLMN' })).toEqual(['rfc'])
    expect(issues({ ...ok, code: 'X'.repeat(41) })).toEqual(['code max'])
    expect(issues({ ...ok, notes: 'x'.repeat(501) })).toEqual(['too long'])
  })
})

describe('unit and family forms', () => {
  it('a unit needs a code of up to 20 characters; the description is optional', () => {
    const schema = makeListItemSchema('unit', messages)
    expect(schema.safeParse({ code: 'M2', text: '' }).success).toBe(true)
    expect(schema.safeParse({ code: ' ', text: '' }).error?.issues[0].message).toBe('code required')
    expect(schema.safeParse({ code: 'X'.repeat(21), text: '' }).error?.issues[0].message).toBe('code max')
    expect(schema.safeParse({ code: 'M2', text: 'x'.repeat(121) }).error?.issues[0].message).toBe('too long')
  })

  it('a family needs a code of up to 40 characters and a name', () => {
    const schema = makeListItemSchema('family', messages)
    expect(schema.safeParse({ code: '301-ARE', text: 'Arenas' }).success).toBe(true)
    expect(schema.safeParse({ code: '301', text: '' }).error?.issues[0].message).toBe('name required')
    expect(schema.safeParse({ code: 'X'.repeat(41), text: 'A' }).error?.issues[0].message).toBe('code max')
  })
})

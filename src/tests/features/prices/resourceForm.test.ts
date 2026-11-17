import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../../lib/http'
import type { ResourceDetail } from '../../../features/prices/pricesApi'
import {
  costBody,
  createLaborBody,
  createResourceBody,
  emptyLaborValues,
  emptyResourceValues,
  laborPatchBody,
  laborValuesFrom,
  makeCostSchema,
  makeLaborSchema,
  makeResourceSchema,
  realWagePreview,
  resourcePatchBody,
  resourceValuesFrom,
  resourceWriteErrorKind,
  type LaborValues,
  type ResourceValues,
} from '../../../features/prices/resourceForm'

const messages = {
  codeRequired: 'code required',
  codeMax: 'code max',
  nameRequired: 'name required',
  nameMax: 'name max',
  unitRequired: 'unit required',
  brandMax: 'brand max',
  descriptionMax: 'description max',
  costRequired: 'cost required',
  costInvalid: 'cost invalid',
  costDecimals: 'cost decimals',
  costMax: 'cost max',
  skuMax: 'sku max',
  noteMax: 'note max',
}

const dollars = { currency: 'USD' as const, toMxn: (amount: number) => amount * 20, fromMxn: (amount: number) => amount / 20 }

const valid: ResourceValues = {
  ...emptyResourceValues,
  code: ' man-cem-001 ',
  name: '  Cemento gris ',
  unitId: 'u-1',
  cost: '245.5',
}

function errors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]))
}

const detail: ResourceDetail = {
  id: 'r-1',
  code: 'MAN-CEM-001',
  type: 'MATERIAL',
  name: 'Cemento gris',
  unit: { id: 'u-1', code: 'SACO' },
  family: { id: 'f-1', code: '301', name: 'AGREGADOS' },
  supplier: null,
  brand: 'Cemex',
  isPercentage: false,
  isComposite: false,
  isHourlyCost: false,
  discontinued: false,
  currentCost: '245.50',
  costUpdatedAt: '2026-11-15T18:02:11Z',
  source: 'MANUAL',
  missingFromImportAt: null,
  archivedAt: null,
  description: 'Bulto',
  reference: null,
  sapCode: null,
  technicalSheet: null,
  procedure: null,
  grouper: null,
  importedCost: null,
  importedCostOn: null,
  createdAt: '2026-11-15T18:02:11Z',
  updatedAt: '2026-11-15T18:02:11Z',
  history: [],
  laborDetail: null,
  equipmentDetail: null,
  analysis: null,
  usedIn: { count: 0, sample: [] },
}

const laborMessages = {
  wageRequired: 'wage required',
  wageInvalid: 'wage invalid',
  wageDecimals: 'wage decimals',
  wageMax: 'wage max',
  fsrRequired: 'fsr required',
  fsrRange: 'fsr range',
  fsrDecimals: 'fsr decimals',
}

const wage: LaborValues = { ...emptyLaborValues, nominalWage: '350', fsr: '1.7', perDiem: '10.5' }

const peon: ResourceDetail = {
  ...detail,
  id: 'r-2',
  code: 'MO-PEON',
  type: 'LABOR',
  brand: null,
  currentCost: '500.00',
  laborDetail: {
    nominalWage: '333.33',
    fsr: '1.5',
    fsrSource: 'IMPORTED',
    fsbc: null,
    sbc: null,
    perDiem: '0.00',
    mealsLodging: '0.00',
    funeralExpenses: '0.00',
    otherBenefits: '0.00',
    fasarType: null,
    imported: { fsr: '1.5', realWage: '500.00', fsbc: null, sbc: null },
    fsrMismatch: false,
    realWage: '500.00',
  },
}

describe('makeResourceSchema', () => {
  it('accepts a code, name, unit and a cost with up to two decimals', () => {
    expect(makeResourceSchema(messages, { withCost: true }).safeParse(valid).success).toBe(true)
    expect(makeResourceSchema(messages, { withCost: true }).safeParse({ ...valid, cost: '0' }).success).toBe(true)
  })

  it('names each broken rule', () => {
    const result = makeResourceSchema(messages, { withCost: true }).safeParse({
      ...valid,
      code: '   ',
      name: '',
      unitId: '',
      brand: 'B'.repeat(81),
      cost: '1.234',
    })
    expect(errors(result)).toEqual({
      code: 'code required',
      name: 'name required',
      unitId: 'unit required',
      brand: 'brand max',
      cost: 'cost decimals',
    })
  })

  it('limits the code to 40 characters and the name to 160', () => {
    const result = makeResourceSchema(messages, { withCost: true }).safeParse({ ...valid, code: 'X'.repeat(41), name: 'N'.repeat(161) })
    expect(errors(result)).toEqual({ code: 'code max', name: 'name max' })
  })

  it('requires a cost below 10^12 pesos once converted', () => {
    const schema = makeResourceSchema(messages, { withCost: true, money: dollars })
    expect(errors(schema.safeParse({ ...valid, cost: '' }))).toEqual({ cost: 'cost required' })
    expect(errors(schema.safeParse({ ...valid, cost: '-1' }))).toEqual({ cost: 'cost invalid' })
    expect(errors(schema.safeParse({ ...valid, cost: '50000000000' }))).toEqual({ cost: 'cost max' })
  })

  it('ignores the cost when editing', () => {
    expect(makeResourceSchema(messages, { withCost: false }).safeParse({ ...valid, cost: '' }).success).toBe(true)
  })
})

describe('createResourceBody', () => {
  it('trims, upper-cases the code, converts the cost to pesos and sends empty choices as null', () => {
    expect(createResourceBody('MATERIAL', { ...valid, brand: ' Cemex ', description: '  ' }, dollars)).toEqual({
      type: 'MATERIAL',
      code: 'MAN-CEM-001',
      name: 'Cemento gris',
      description: null,
      unitId: 'u-1',
      familyId: null,
      supplierId: null,
      brand: 'Cemex',
      cost: '4910.00',
    })
  })

  it('leaves the brand out of equipment', () => {
    const body = createResourceBody('EQUIPMENT', { ...valid, brand: 'Cat', familyId: 'f-1', supplierId: 's-1' })
    expect(body).not.toHaveProperty('brand')
    expect(body.familyId).toBe('f-1')
    expect(body.supplierId).toBe('s-1')
    expect(body.cost).toBe('245.50')
  })
})

describe('resourcePatchBody', () => {
  it('sends nothing when nothing changed', () => {
    expect(resourcePatchBody(detail, resourceValuesFrom(detail))).toEqual({})
  })

  it('sends only the changed fields and an empty string to clear', () => {
    const values = { ...resourceValuesFrom(detail), name: ' Cemento blanco ', description: '', familyId: '', supplierId: 's-2', brand: '' }
    expect(resourcePatchBody(detail, values)).toEqual({
      name: 'Cemento blanco',
      description: '',
      familyId: '',
      supplierId: 's-2',
      brand: '',
    })
  })

  it('never sends a brand for equipment', () => {
    const equipment = { ...detail, type: 'EQUIPMENT' as const, brand: null }
    expect(resourcePatchBody(equipment, { ...resourceValuesFrom(equipment), brand: 'Cat', unitId: 'u-2' })).toEqual({ unitId: 'u-2' })
  })
})

describe('resourceValuesFrom', () => {
  it('fills the edit form from the detail', () => {
    expect(resourceValuesFrom(detail)).toEqual({
      code: 'MAN-CEM-001',
      name: 'Cemento gris',
      description: 'Bulto',
      unitId: 'u-1',
      familyId: 'f-1',
      supplierId: '',
      brand: 'Cemex',
      cost: '',
    })
  })
})

describe('cost entry', () => {
  it('validates the amount, SKU and note', () => {
    const schema = makeCostSchema(messages)
    expect(schema.safeParse({ amount: '250', supplierId: '', sku: '', note: '' }).success).toBe(true)
    expect(errors(schema.safeParse({ amount: '', supplierId: '', sku: 'S'.repeat(65), note: 'N'.repeat(161) }))).toEqual({
      amount: 'cost required',
      sku: 'sku max',
      note: 'note max',
    })
  })

  it('builds the body in pesos with blanks as null', () => {
    expect(costBody({ amount: '12.5', supplierId: '', sku: ' A-1 ', note: '  ' }, dollars)).toEqual({
      amount: '250.00',
      supplierId: null,
      sku: 'A-1',
      note: null,
    })
  })
})

describe('labor wage', () => {
  it('requires a nominal wage and an FSR from 1 to 3 with up to eight decimals; benefits may be empty', () => {
    const schema = makeLaborSchema(laborMessages)
    expect(schema.safeParse(wage).success).toBe(true)
    expect(schema.safeParse({ ...wage, fsr: '3' }).success).toBe(true)
    expect(errors(schema.safeParse({ ...emptyLaborValues }))).toEqual({ nominalWage: 'wage required', fsr: 'fsr required' })
    expect(errors(schema.safeParse({ ...wage, fsr: '3.01' }))).toEqual({ fsr: 'fsr range' })
    expect(errors(schema.safeParse({ ...wage, fsr: '0.99' }))).toEqual({ fsr: 'fsr range' })
    expect(errors(schema.safeParse({ ...wage, fsr: '1.123456789' }))).toEqual({ fsr: 'fsr decimals' })
    expect(errors(schema.safeParse({ ...wage, nominalWage: '350.001', perDiem: '-1' }))).toEqual({
      nominalWage: 'wage decimals',
      perDiem: 'wage invalid',
    })
  })

  it('previews the real wage as round(wage x FSR) plus the daily benefits, null until both are typed', () => {
    expect(realWagePreview(wage)).toBe('605.50')
    expect(realWagePreview({ ...emptyLaborValues, nominalWage: '333.33', fsr: '1.5' })).toBe('500.00')
    expect(realWagePreview({ ...emptyLaborValues, nominalWage: '100.01', fsr: '1.25' })).toBe('125.01')
    expect(realWagePreview({ ...emptyLaborValues, nominalWage: '350' })).toBeNull()
    expect(realWagePreview({ ...wage, fsr: 'x' })).toBeNull()
  })

  it('creates a labor category with its wage in pesos and no cost', () => {
    expect(createLaborBody({ ...valid, cost: '', brand: 'ignored' }, wage)).toEqual({
      type: 'LABOR',
      code: 'MAN-CEM-001',
      name: 'Cemento gris',
      description: null,
      unitId: 'u-1',
      familyId: null,
      supplierId: null,
      laborDetail: {
        nominalWage: '350.00',
        fsr: '1.7',
        perDiem: '10.50',
        mealsLodging: '0.00',
        funeralExpenses: '0.00',
        otherBenefits: '0.00',
      },
    })
    expect(createLaborBody(valid, { ...wage, nominalWage: '20' }, dollars).laborDetail.nominalWage).toBe('400.00')
  })

  it('edits only the wage fields that changed', () => {
    expect(laborValuesFrom(peon)).toEqual({
      nominalWage: '333.33',
      fsr: '1.5',
      perDiem: '0.00',
      mealsLodging: '0.00',
      funeralExpenses: '0.00',
      otherBenefits: '0.00',
    })
    expect(laborPatchBody(peon, laborValuesFrom(peon))).toEqual({})
    expect(laborPatchBody(peon, { ...laborValuesFrom(peon), nominalWage: '400', perDiem: '0' })).toEqual({
      laborDetail: { nominalWage: '400.00' },
    })
    expect(laborPatchBody(peon, { ...laborValuesFrom(peon), fsr: '1.60', otherBenefits: '5' })).toEqual({
      laborDetail: { fsr: '1.6', otherBenefits: '5.00' },
    })
  })
})

describe('resourceWriteErrorKind', () => {
  it('maps the conflict codes and statuses of a write', () => {
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'DUPLICATE_CODE'))).toBe('duplicateCode')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'ARCHIVED_UNIT'))).toBe('archivedUnit')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'ARCHIVED_FAMILY'))).toBe('archivedFamily')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'ARCHIVED_SUPPLIER'))).toBe('archivedSupplier')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'ARCHIVED_RESOURCE'))).toBe('archivedResource')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'DERIVED_COST'))).toBe('derivedCost')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'LABOR_COST_FROM_WAGE'))).toBe('laborCostFromWage')
    expect(resourceWriteErrorKind(new ApiError(409, undefined, 'DATA_CONFLICT'))).toBe('generic')
    expect(resourceWriteErrorKind(new ApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalid')
    expect(resourceWriteErrorKind(new ApiError(403))).toBe('forbidden')
    expect(resourceWriteErrorKind(new ApiError(404))).toBe('notFound')
    expect(resourceWriteErrorKind(new ApiError(401))).toBe('session')
    expect(resourceWriteErrorKind(new Error('offline'))).toBe('generic')
  })
})

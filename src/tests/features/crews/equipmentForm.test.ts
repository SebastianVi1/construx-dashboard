import { describe, expect, test } from 'bun:test'
import { dailyCostCents, dailyCostCentsFromRate, makeEquipmentSchema, prefilledDailyCost } from '../../../features/crews/equipmentForm'

const messages = {
  typeRequired: 'typeRequired',
  typeMax: 'typeMax',
  identifierRequired: 'identifierRequired',
  identifierMax: 'identifierMax',
  dailyCostInvalid: 'dailyCostInvalid',
  dailyCostDecimals: 'dailyCostDecimals',
  dailyCostMax: 'dailyCostMax',
}

describe('equipment form', () => {
  test('sends pesos as centavos, and nothing when empty', () => {
    expect(dailyCostCents('500')).toBe(50000)
    expect(dailyCostCents('3500.55')).toBe(350055)
    expect(dailyCostCents('')).toBeNull()
    expect(dailyCostCents('10', { toMxn: (amount) => amount * 20, fromMxn: (mxn) => mxn / 20 })).toBe(20000)
  })

  test('the daily cost is optional but must be a valid amount', () => {
    const schema = makeEquipmentSchema(messages)
    expect(schema.safeParse({ type: 'Excavator', identifier: 'EX-1', dailyCost: '' }).success).toBe(true)
    expect(schema.safeParse({ type: 'Excavator', identifier: 'EX-1', dailyCost: '0' }).success).toBe(true)
    const tooLong = schema.safeParse({ type: 'x'.repeat(61), identifier: 'EX-1', dailyCost: '1.234' })
    expect(tooLong.error?.issues.map((issue) => issue.message)).toEqual(['typeMax', 'dailyCostDecimals'])
  })

  test('a linked rate gives a daily cost of eight hours, in centavos and exactly', () => {
    expect(dailyCostCentsFromRate('85.33')).toBe(68264)
    expect(dailyCostCentsFromRate('0.10')).toBe(80)
    expect(dailyCostCentsFromRate(null)).toBeNull()
  })

  test('picking a rate fills an empty daily cost in the active currency and keeps a typed one', () => {
    expect(prefilledDailyCost('', '85.33')).toBe('682.64')
    expect(prefilledDailyCost(' ', '85.33')).toBe('682.64')
    expect(prefilledDailyCost('500', '85.33')).toBe('500')
    expect(prefilledDailyCost('', null)).toBe('')
    expect(prefilledDailyCost('', '100.00', { toMxn: (amount) => amount * 20, fromMxn: (mxn) => mxn / 20 })).toBe('40.00')
  })
})

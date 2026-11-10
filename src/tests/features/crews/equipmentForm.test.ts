import { describe, expect, test } from 'bun:test'
import { dailyCostCents, makeEquipmentSchema } from '../../../features/crews/equipmentForm'

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
})

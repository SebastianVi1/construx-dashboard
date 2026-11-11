import { describe, expect, test } from 'bun:test'
import { makeZoneSchema, zoneInput } from '../../../features/floor-plans/zoneForm'
import { messages } from '../../../i18n'

const v = messages.en.floorPlans.zones.validation

describe('zone form', () => {
  test('uses translated messages and realistic limits', () => {
    const schema = makeZoneSchema(v)
    expect(schema.safeParse({ name: 'Losa nivel 2', description: '', status: 'IN_PROGRESS' }).success).toBe(true)
    const result = schema.safeParse({ name: 'x'.repeat(61), description: 'y'.repeat(501), status: 'DONE' })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([v.nameMax, v.descriptionMax])
    expect(schema.safeParse({ name: ' ', description: '', status: 'DONE' }).error?.issues[0].message).toBe(v.nameRequired)
  })

  test('sends a blank description as null', () => {
    expect(zoneInput({ name: ' Losa ', description: '  ', status: 'DONE' })).toEqual({
      name: 'Losa',
      description: null,
      status: 'DONE',
    })
  })
})

import { describe, expect, test } from 'bun:test'
import { buildProfileUpdate, makeProfileSchema, profileChanges, profileFormValues } from '../../../features/profile/profileForm'

const messages = {
  fullNameRequired: 'name required',
  fullNameMax: 'name too long',
  phoneRequired: 'phone required',
  phoneFormat: 'phone format',
  tradeMax: 'trade too long',
}
const schema = makeProfileSchema(messages)

function errorsOf(values: { fullName: string; phoneNumber: string; trade: string }) {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('makeProfileSchema', () => {
  test('accepts a full name, an E.164 phone and an optional trade', () => {
    expect(errorsOf({ fullName: 'Ana López', phoneNumber: ' +5491122334455 ', trade: '' })).toEqual([])
  })

  test('requires a full name and a phone', () => {
    expect(errorsOf({ fullName: '  ', phoneNumber: '', trade: '' })).toEqual(['name required', 'phone required'])
  })

  test('rejects a phone without a country code or with too many digits', () => {
    expect(errorsOf({ fullName: 'Ana', phoneNumber: '1122334455', trade: '' })).toEqual(['phone format'])
    expect(errorsOf({ fullName: 'Ana', phoneNumber: '+0123', trade: '' })).toEqual(['phone format'])
    expect(errorsOf({ fullName: 'Ana', phoneNumber: '+1234567890123456', trade: '' })).toEqual(['phone format'])
  })

  test('limits the full name to 160 and the trade to 80 characters', () => {
    expect(errorsOf({ fullName: 'a'.repeat(161), phoneNumber: '+541122', trade: 'b'.repeat(81) })).toEqual([
      'name too long',
      'trade too long',
    ])
  })
})

describe('profileFormValues', () => {
  test('turns unset fields into empty strings', () => {
    expect(profileFormValues({ fullName: null, phoneNumber: null, trade: null })).toEqual({
      fullName: '',
      phoneNumber: '',
      trade: '',
    })
  })
})

describe('buildProfileUpdate', () => {
  test('trims every field and sends an empty trade to clear it', () => {
    expect(buildProfileUpdate({ fullName: ' Ana López ', phoneNumber: ' +541122 ', trade: '  ' })).toEqual({
      fullName: 'Ana López',
      phoneNumber: '+541122',
      trade: '',
    })
  })
})

describe('profileChanges', () => {
  const saved = { fullName: 'Ana López', phoneNumber: '+541122', trade: 'Electrician' }

  test('lists only the fields that change, with their old and new values', () => {
    expect(profileChanges(saved, { fullName: 'Ana María López', phoneNumber: '+541122', trade: '' })).toEqual([
      { field: 'fullName', from: 'Ana López', to: 'Ana María López' },
      { field: 'trade', from: 'Electrician', to: '' },
    ])
  })

  test('treats an unset field as empty and returns nothing when nothing changes', () => {
    expect(profileChanges({ fullName: null, phoneNumber: null, trade: null }, { fullName: 'Ana', phoneNumber: '+541122', trade: '' })).toEqual([
      { field: 'fullName', from: '', to: 'Ana' },
      { field: 'phoneNumber', from: '', to: '+541122' },
    ])
    expect(profileChanges(saved, { fullName: 'Ana López', phoneNumber: '+541122', trade: 'Electrician' })).toEqual([])
  })
})

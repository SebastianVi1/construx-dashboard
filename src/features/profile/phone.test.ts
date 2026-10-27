import { describe, expect, test } from 'bun:test'
import { countryOptions, defaultCountry, formatNational, formatPhone, joinPhone, searchCountries, splitPhone } from './phone'

describe('formatPhone', () => {
  test('groups a stored E.164 number the way its country writes it', () => {
    expect(formatPhone('+5491122334455')).toBe('+54 9 11 2233 4455')
    expect(formatPhone('+14155552671')).toBe('+1 415 555 2671')
  })

  test('keeps unset and unparsable values as they are', () => {
    expect(formatPhone(null)).toBeNull()
    expect(formatPhone('+999')).toBe('+999')
  })
})

describe('splitPhone and joinPhone', () => {
  test('split a stored number into its country and national part', () => {
    expect(splitPhone('+5491122334455')).toEqual({ country: 'AR', national: '91122334455' })
    expect(splitPhone('+14165550100')).toEqual({ country: 'CA', national: '4165550100' })
    expect(splitPhone('')).toEqual({ country: null, national: '' })
  })

  test('join a country and a typed national number into E.164, ignoring separators', () => {
    expect(joinPhone('AR', '9 11 2233-4455')).toBe('+5491122334455')
    expect(joinPhone('MX', '(55) 1234 5678')).toBe('+525512345678')
  })

  test('drop the trunk prefix people type locally', () => {
    expect(joinPhone('GB', '07400 123456')).toBe('+447400123456')
  })

  test('give an empty value without a country or digits', () => {
    expect(joinPhone(null, '1122334455')).toBe('')
    expect(joinPhone('AR', ' - ')).toBe('')
  })
})

describe('formatNational', () => {
  test('adds separators while a number is still incomplete', () => {
    expect(formatNational('415555', 'US')).toBe('(415) 555')
    expect(formatNational('', 'US')).toBe('')
  })

  test('groups a complete number like the stored display, without the dial code', () => {
    expect(formatNational('91122334455', 'AR')).toBe('9 11 2233 4455')
    expect(formatNational('5512345678', 'MX')).toBe('55 1234 5678')
  })
})

describe('countries', () => {
  const english = countryOptions('en')
  const spanish = countryOptions('es')

  test('lists every country with its dial code, named in the current language', () => {
    expect(english.find((country) => country.code === 'DE')).toEqual({ code: 'DE', dialCode: '49', name: 'Germany' })
    expect(spanish.find((country) => country.code === 'DE')?.name).toBe('Alemania')
  })

  test('search by name ignoring case and accents, by ISO code, or by dial code', () => {
    expect(searchCountries(spanish, 'mexico').map((country) => country.code)).toContain('MX')
    expect(searchCountries(english, 'ar')[0].code).toBe('AR')
    expect(searchCountries(english, '+54').map((country) => country.code)).toEqual(['AR'])
    expect(searchCountries(english, '  ')).toBe(english)
  })

  test('default to the first browser language with a known region', () => {
    expect(defaultCountry(['es', 'es-AR', 'en-US'])).toBe('AR')
    expect(defaultCountry(['en'])).toBeNull()
  })
})

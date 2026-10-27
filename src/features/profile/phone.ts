import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min'
import type { Locale } from '../../i18n/locale'

export type { CountryCode }

export type CountryOption = { code: CountryCode; dialCode: string; name: string }

/** A stored E.164 number grouped for reading (`+54 9 11 2233 4455`); unparsable values stay as they are. */
export function formatPhone(value: string | null): string | null {
  if (!value) return value
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value
}

/** Country and national digits of a stored number, to fill the edit form. */
export function splitPhone(value: string): { country: CountryCode | null; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined
  return { country: parsed?.country ?? null, national: parsed ? String(parsed.nationalNumber) : '' }
}

/** E.164 from a country and what the person typed: separators and a local trunk prefix are dropped. */
export function joinPhone(country: CountryCode | null, national: string): string {
  const digits = national.replace(/\D/g, '')
  if (!country || !digits) return ''
  return parsePhoneNumberFromString(digits, country)?.number ?? `+${getCountryCallingCode(country)}${digits}`
}

/**
 * The national part with the country's separators. A complete number uses the same
 * grouping as `formatPhone` without the dial code (as-you-type cannot group every
 * country, e.g. Argentine mobiles); a partial one falls back to as-you-type.
 */
export function formatNational(national: string, country: CountryCode): string {
  if (!national) return ''
  const parsed = parsePhoneNumberFromString(national, country)
  if (parsed?.isValid()) return parsed.formatInternational().replace(`+${parsed.countryCallingCode} `, '')
  return new AsYouType(country).input(national)
}

/** Every country with its dial code, named and sorted in the UI language. */
export function countryOptions(locale: Locale): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return getCountries()
    .map((code) => ({ code, dialCode: getCountryCallingCode(code), name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Match by name (case and accents ignored), ISO code or dial code; exact codes and name prefixes first. */
export function searchCountries(options: CountryOption[], query: string): CountryOption[] {
  const text = normalize(query.trim())
  if (!text) return options
  const digits = text.replace(/^\+/, '')
  if (/^\d+$/.test(digits)) return options.filter((country) => country.dialCode.startsWith(digits))
  const rank = (country: CountryOption) => {
    if (country.code.toLowerCase() === text) return 0
    const name = normalize(country.name)
    if (name.startsWith(text)) return 1
    return name.includes(text) ? 2 : -1
  }
  return options
    .map((country) => ({ country, rank: rank(country) }))
    .filter((match) => match.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((match) => match.country)
}

/** Country of the first browser language that names a region (`es-AR` → `AR`). */
export function defaultCountry(languages: readonly string[]): CountryCode | null {
  const known = new Set<string>(getCountries())
  for (const language of languages) {
    const region = language.split('-')[1]?.toUpperCase()
    if (region && known.has(region)) return region as CountryCode
  }
  return null
}

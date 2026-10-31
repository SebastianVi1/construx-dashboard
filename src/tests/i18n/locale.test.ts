import { describe, expect, it } from 'bun:test'
import { isLocale, resolveLocale } from '../../i18n/locale'
import { messages } from '../../i18n/messages'
import { formatMessage } from '../../i18n/format'

describe('resolveLocale', () => {
  it('returns a valid saved locale over the browser language', () => {
    expect(resolveLocale('es', 'en-US')).toBe('es')
    expect(resolveLocale('en', 'es-AR')).toBe('en')
  })

  it('detects Spanish from a browser language starting with es', () => {
    expect(resolveLocale(null, 'es-AR')).toBe('es')
    expect(resolveLocale(null, 'ES')).toBe('es')
    expect(resolveLocale(null, 'es')).toBe('es')
  })

  it('falls back to English for anything else', () => {
    expect(resolveLocale(null, 'en-US')).toBe('en')
    expect(resolveLocale(null, 'pt-BR')).toBe('en')
    expect(resolveLocale(null, undefined)).toBe('en')
  })

  it('ignores an invalid saved value', () => {
    expect(resolveLocale('bogus', 'es')).toBe('es')
    expect(resolveLocale('bogus', 'fr')).toBe('en')
    expect(resolveLocale('', 'fr')).toBe('en')
  })
})

describe('isLocale', () => {
  it('recognizes only the supported locales', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('es')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return []
}

function leafStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((child) => leafStrings(child))
  }
  return []
}

describe('messages', () => {
  it('has identical keys across every supported locale', () => {
    const enKeys = keyPaths(messages.en).sort()
    const esKeys = keyPaths(messages.es).sort()
    expect(esKeys).toEqual(enKeys)
  })

  it('has no empty strings in any locale', () => {
    for (const dictionary of Object.values(messages)) {
      for (const value of leafStrings(dictionary)) {
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('formatMessage', () => {
  it('replaces placeholders with the provided values', () => {
    expect(formatMessage('Hello {name}', { name: 'Ada' })).toBe('Hello Ada')
    expect(formatMessage('{count} of {total}', { count: 3, total: 10 })).toBe('3 of 10')
  })

  it('leaves unknown placeholders untouched', () => {
    expect(formatMessage('Hi {name}', {})).toBe('Hi {name}')
    expect(formatMessage('Hi {name}', { other: 'x' })).toBe('Hi {name}')
  })
})

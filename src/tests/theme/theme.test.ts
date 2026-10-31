import { describe, expect, test } from 'bun:test'
import { isTheme, resolveTheme } from '../../theme/theme'

describe('resolveTheme', () => {
  test('a saved choice wins', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  test('falls back to light when nothing valid is saved', () => {
    expect(resolveTheme(null)).toBe('light')
    expect(resolveTheme('sepia')).toBe('light')
  })
})

describe('isTheme', () => {
  test('accepts only the supported themes', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('Dark')).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })
})

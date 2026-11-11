import { describe, expect, test } from 'bun:test'
import { isMainScreen } from '../../lib/mainScreen'

describe('main screens', () => {
  test('the screens a person lands on from the navigation are main screens', () => {
    for (const path of ['/sites', '/tasks', '/materials', '/finance', '/documents', '/members', '/account']) {
      expect(isMainScreen(path)).toBe(true)
    }
  })

  test('the sections inside a site are not', () => {
    expect(isMainScreen('/sites/abc')).toBe(false)
    expect(isMainScreen('/sites/abc/floor-plans/123')).toBe(false)
    expect(isMainScreen('/sites/abc/phases')).toBe(false)
    expect(isMainScreen('/documents/sites/abc')).toBe(false)
    expect(isMainScreen('/materials/abc')).toBe(false)
    expect(isMainScreen('/excel/folders/abc')).toBe(false)
  })

  test('a trailing slash does not change the answer', () => {
    expect(isMainScreen('/sites/')).toBe(true)
    expect(isMainScreen('/tasks/')).toBe(true)
  })

  test('unknown paths are sections', () => {
    expect(isMainScreen('/')).toBe(false)
    expect(isMainScreen('/nowhere')).toBe(false)
  })
})

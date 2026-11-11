import { afterEach, describe, expect, test } from 'bun:test'
import {
  FIRST_LOAD_MIN_MS,
  clearFirstLoadWindows,
  firstLoadDelay,
  firstLoadWindow,
} from '../../../components/data/useRemoteData'

describe('first-load minimum', () => {
  afterEach(() => clearFirstLoadWindows())

  test('holds a new screen long enough to read its skeleton', () => {
    expect(FIRST_LOAD_MIN_MS).toBe(2000)
    expect(firstLoadDelay(0, 0)).toBe(2000)
    expect(firstLoadDelay(0, 500)).toBe(1500)
    expect(firstLoadDelay(0, 1999)).toBe(1)
  })

  test('never waits once the window has elapsed', () => {
    expect(firstLoadDelay(0, 2000)).toBe(0)
    expect(firstLoadDelay(0, 9000)).toBe(0)
  })

  test('accepts another minimum for callers that need a different window', () => {
    expect(firstLoadDelay(1000, 1200, 500)).toBe(300)
    expect(firstLoadDelay(1000, 1700, 500)).toBe(0)
  })

  test('nested containers share the navigation window instead of adding a delay', () => {
    const nav = 'navigation-1'
    expect(firstLoadWindow(nav, 1000)).toBe(1000)
    // A panel mounting 1.5 s later only waits the remaining 0.5 s.
    expect(firstLoadWindow(nav, 2500)).toBe(1000)
    expect(firstLoadDelay(firstLoadWindow(nav, 2500), 2500)).toBe(500)
    // A container mounting after the window waits for nothing.
    expect(firstLoadDelay(firstLoadWindow(nav, 3500), 3500)).toBe(0)
    // The next navigation starts its own window.
    expect(firstLoadWindow('navigation-2', 9000)).toBe(9000)
  })
})

import { afterEach, describe, expect, test } from 'bun:test'
import {
  FIRST_LOAD_MIN_MS,
  clearFirstLoadWindows,
  firstLoadDelay,
  firstLoadWindow,
  failedLoad,
} from '../../../components/data/useRemoteData'

describe('first-load minimum', () => {
  afterEach(() => clearFirstLoadWindows())

  test('holds a new screen long enough to read its skeleton', () => {
    expect(FIRST_LOAD_MIN_MS).toBe(500)
    expect(firstLoadDelay(0, 0)).toBe(500)
    expect(firstLoadDelay(0, 250)).toBe(250)
    expect(firstLoadDelay(0, 499)).toBe(1)
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
    // A panel mounting 0.25 s later only waits the remaining 0.25 s.
    expect(firstLoadWindow(nav, 1250)).toBe(1000)
    expect(firstLoadDelay(firstLoadWindow(nav, 1250), 1250)).toBe(250)
    // A container mounting after the window waits for nothing.
    expect(firstLoadDelay(firstLoadWindow(nav, 1600), 1600)).toBe(0)
    // The next navigation starts its own window.
    expect(firstLoadWindow('navigation-2', 9000)).toBe(9000)
  })
})

describe('a failed load', () => {
  const notFound = new Error('404')
  const offline = new Error('network')
  const gone = (error: unknown) => error === notFound

  test('keeps the rows a revalidation already showed', () => {
    expect(failedLoad(offline, ['row'], gone)).toEqual({ ok: true, data: ['row'] })
    expect(failedLoad(offline, ['row'])).toEqual({ ok: true, data: ['row'] })
  })

  test('is final when the answer says the thing is gone, even with rows on screen', () => {
    expect(failedLoad(notFound, ['row'], gone)).toEqual({ ok: false, error: notFound })
  })

  test('is an error when nothing was shown before', () => {
    expect(failedLoad(offline, undefined, gone)).toEqual({ ok: false, error: offline })
  })
})

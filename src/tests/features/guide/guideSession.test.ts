import { describe, expect, it } from 'bun:test'
import {
  GUIDE_OPENED_KEY,
  guideOpenedThisSession,
  rememberGuideOpened,
  type GuideSessionStorage,
} from '../../../features/guide/guideSession'

describe('guide session', () => {
  it('reads false by default and true after the guide opens', () => {
    const values = new Map<string, string>()
    const storage: GuideSessionStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
    }
    expect(guideOpenedThisSession(storage)).toBe(false)
    rememberGuideOpened(storage)
    expect(values.get(GUIDE_OPENED_KEY)).toBe('1')
    expect(guideOpenedThisSession(storage)).toBe(true)
  })

  it('treats missing storage as unopened without throwing', () => {
    expect(guideOpenedThisSession(undefined)).toBe(false)
    expect(() => rememberGuideOpened(undefined)).not.toThrow()
  })

  it('treats a blocked read as unopened without throwing', () => {
    const storage: GuideSessionStorage = {
      getItem: () => { throw new Error('blocked read') },
      setItem: () => {},
    }
    expect(guideOpenedThisSession(storage)).toBe(false)
  })

  it('ignores a blocked write and still reads unopened', () => {
    const storage: GuideSessionStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('blocked write') },
    }
    expect(() => rememberGuideOpened(storage)).not.toThrow()
    expect(guideOpenedThisSession(storage)).toBe(false)
  })
})

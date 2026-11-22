import { describe, expect, it } from 'bun:test'
import { forgetTourMemory, readTourMemory, rememberTourIds, tourFactsFrom, tourMemoryKey, type TourStorage } from '../../../features/guide/tourMemory'

function fakeStorage() {
  const values = new Map<string, string>()
  const storage: TourStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
  return { storage, values }
}

describe('tour browser memory', () => {
  it('reads empty storage and merges memory under the Company key', () => {
    const { storage, values } = fakeStorage()
    expect(readTourMemory('org-1', storage)).toEqual({})
    expect(rememberTourIds('org-1', { started: true }, storage)).toEqual({ started: true })
    expect(rememberTourIds('org-1', { siteId: 's1' }, storage)).toEqual({ started: true, siteId: 's1' })
    expect(tourMemoryKey('org-1')).toBe('construx.guide.tour.org-1')
    expect(JSON.parse(values.get('construx.guide.tour.org-1')!)).toEqual({ started: true, siteId: 's1' })
  })

  it('keeps Company ids separate', () => {
    const { storage } = fakeStorage()
    rememberTourIds('org-1', { siteId: 's1' }, storage)
    expect(readTourMemory('org-2', storage)).toEqual({})
    rememberTourIds('org-2', { siteId: 's2' }, storage)
    expect(readTourMemory('org-1', storage).siteId).toBe('s1')
  })

  it('discards malformed, non-object, invalid ids and unknown keys', () => {
    const { storage, values } = fakeStorage()
    const key = tourMemoryKey('org-1')
    for (const value of ['{', 'null', '[]', '42', '{"siteId":1}', '{"siteId":""}', '{"other":"x"}']) {
      values.set(key, value)
      expect(readTourMemory('org-1', storage)).toEqual({})
    }
    values.set(key, '{"siteId":"s1","other":"x","started":true}')
    expect(readTourMemory('org-1', storage)).toEqual({ siteId: 's1', started: true })
  })

  it('never throws when reads, writes or removal are blocked', () => {
    const blocked: TourStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(readTourMemory('org-1', blocked)).toEqual({})
    expect(rememberTourIds('org-1', { siteId: 's1' }, blocked)).toEqual({ siteId: 's1' })
    expect(() => forgetTourMemory('org-1', blocked)).not.toThrow()
    const { storage } = fakeStorage()
    expect(rememberTourIds('org-1', { siteId: 's1' }, { ...storage, setItem: blocked.setItem })).toEqual({ siteId: 's1' })
  })

  it('treats an explicitly absent storage as empty', () => {
    expect(readTourMemory('org-1', undefined)).toEqual({})
  })

  it('forgets only the named Company', () => {
    const { storage, values } = fakeStorage()
    rememberTourIds('org-1', { siteId: 's1' }, storage)
    rememberTourIds('org-2', { siteId: 's2' }, storage)
    forgetTourMemory('org-1', storage)
    expect(values.has(tourMemoryKey('org-1'))).toBe(false)
    expect(readTourMemory('org-2', storage)).toEqual({ siteId: 's2' })
  })

  it('derives Company facts from the remembered Site id', () => {
    expect(tourFactsFrom({ siteId: 's1' })).toEqual({ hasCompany: true, siteId: 's1' })
    expect(tourFactsFrom({})).toEqual({ hasCompany: true, siteId: null })
  })
})

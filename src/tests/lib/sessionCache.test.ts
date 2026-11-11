import { afterEach, describe, expect, test } from 'bun:test'
import { clearSessionValues, hasSessionValue, readSessionValue, writeSessionValue } from '../../lib/sessionCache'

describe('session cache', () => {
  afterEach(() => clearSessionValues())

  test('a key that was shown reads its value back', () => {
    expect(hasSessionValue('org:sites')).toBe(false)
    writeSessionValue('org:sites', [{ id: 'site-1' }])
    expect(hasSessionValue('org:sites')).toBe(true)
    expect(readSessionValue<{ id: string }[]>('org:sites')).toEqual([{ id: 'site-1' }])
  })

  test('keys do not see each other and unknown keys stay undefined', () => {
    writeSessionValue('org:sites', ['one'])
    writeSessionValue('org:members', ['other'])
    expect(readSessionValue('org:sites')).toEqual(['one'])
    expect(readSessionValue('org:members')).toEqual(['other'])
    expect(readSessionValue('org:equipment')).toBeUndefined()
  })

  test('signing out drops every remembered value', () => {
    writeSessionValue('org:sites', ['one'])
    writeSessionValue('org:members', ['other'])
    clearSessionValues()
    expect(hasSessionValue('org:sites')).toBe(false)
    expect(hasSessionValue('org:members')).toBe(false)
  })

  test('an empty answer still counts as shown', () => {
    writeSessionValue('org:members', [])
    expect(hasSessionValue('org:members')).toBe(true)
    expect(readSessionValue('org:members')).toEqual([])
  })

  test('stops remembering once the tab holds too many entries', () => {
    for (let i = 0; i < 205; i += 1) writeSessionValue(`org:material:${i}`, i)
    expect(hasSessionValue('org:material:0')).toBe(false)
    expect(hasSessionValue('org:material:204')).toBe(true)
  })
})

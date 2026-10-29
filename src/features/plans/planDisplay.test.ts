import { describe, expect, it } from 'bun:test'
import { megabytes, viewUrlExpired } from './planDisplay'

describe('plan display', () => {
  it('megabytes: one decimal', () => {
    expect(megabytes(1024 * 1024 * 1.25)).toBe('1.3')
    expect(megabytes(0)).toBe('0.0')
  })

  it('viewUrlExpired: a link is stale a little before it expires, and without an expiry', () => {
    const now = Date.parse('2026-10-28T18:00:00Z')
    expect(viewUrlExpired('2026-10-28T18:10:00Z', now)).toBe(false)
    expect(viewUrlExpired('2026-10-28T18:00:10Z', now)).toBe(true)
    expect(viewUrlExpired('2026-10-28T17:59:00Z', now)).toBe(true)
    expect(viewUrlExpired(null, now)).toBe(true)
  })
})

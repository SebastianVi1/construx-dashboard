import { describe, expect, it } from 'bun:test'
import { landingGuideHref } from '../../../features/guide/landing'

describe('landingGuideHref', () => {
  it('builds no link when no landing URL is configured', () => {
    expect(landingGuideHref(null, 'es', 'sites')).toBeNull()
    expect(landingGuideHref(null, 'en', 'start')).toBeNull()
  })

  it('opens the Spanish guide chapter for Spanish', () => {
    expect(landingGuideHref('https://construx.test', 'es', 'sites')).toBe('https://construx.test/guia/#sites')
  })

  it('opens the English guide chapter for English', () => {
    expect(landingGuideHref('https://construx.test', 'en', 'finance')).toBe('https://construx.test/en/guide/#finance')
  })

  it('never doubles the slash after a base that ends in one', () => {
    expect(landingGuideHref('https://construx.test/', 'es', 'start')).toBe('https://construx.test/guia/#start')
    expect(landingGuideHref('https://construx.test//', 'en', 'tasks')).toBe('https://construx.test/en/guide/#tasks')
  })

  it('keeps a base path the landing page is served under', () => {
    expect(landingGuideHref('https://example.test/construx/', 'en', 'company')).toBe(
      'https://example.test/construx/en/guide/#company',
    )
  })
})

import { describe, expect, test } from 'bun:test'
import { siteTab, siteTabSearch, siteSectionUrl } from '../../../features/sites/siteNavigation'

describe('site section navigation', () => {
  test('accepts all existing sections and falls back for unknown or missing tabs', () => {
    for (const tab of ['overview', 'details', 'list', 'gantt', 'plans', 'reports'] as const) {
      expect(siteTab(new URLSearchParams({ tab }))).toBe(tab)
    }
    expect(siteTab(new URLSearchParams())).toBe('overview')
    expect(siteTab(new URLSearchParams('tab=unknown'))).toBe('overview')
  })
  test('changes sections without mutating or dropping unrelated query parameters', () => {
    const original = new URLSearchParams('tab=overview&filter=active')
    expect(siteTabSearch(original, 'list').toString()).toBe('tab=list&filter=active')
    expect(original.toString()).toBe('tab=overview&filter=active')
  })
  test('encodes site and anchor identifiers for real existing destinations', () => {
    expect(siteSectionUrl('site/1', 'details', 'site-budget')).toBe('/sites/site%2F1?tab=details#site-budget')
    expect(siteSectionUrl('site1', 'list', 'phase-a/b')).toBe('/sites/site1?tab=list#phase-a%2Fb')
  })
})

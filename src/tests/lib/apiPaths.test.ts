import { describe, expect, it } from 'bun:test'
import { floorPlanPath, organizationPath, sitePath } from '../../lib/apiPaths'

describe('API path builders', () => {
  it('builds the organization path', () => {
    expect(organizationPath('org-1')).toBe('/organizations/org-1')
  })

  it('builds the Site path under its organization', () => {
    expect(sitePath('org-1', 'site-2')).toBe('/organizations/org-1/projects/site-2')
  })

  it('builds the floor plan path under its Site', () => {
    expect(floorPlanPath('org-1', 'site-2', 'fp-3')).toBe('/organizations/org-1/projects/site-2/floor-plans/fp-3')
  })

  it('encodes every segment', () => {
    expect(floorPlanPath('o/1', 's 2', 'f?3')).toBe('/organizations/o%2F1/projects/s%202/floor-plans/f%3F3')
  })
})

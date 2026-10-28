import { describe, expect, it } from 'bun:test'
import { messages } from '../../i18n/messages'
import type { Site } from './sitesApi'
import { buildSitePatch, makeSiteSchema, siteToValues } from './siteForm'

const v = messages.en.sites.validation
const blank = { name: 'Torre Norte', address: '', startDate: '', expectedEndDate: '', status: '' }
const site: Site = {
  id: 'p-1',
  name: 'Torre Norte',
  address: 'Av. Siempre Viva 742',
  startDate: '2026-11-01',
  expectedEndDate: '2027-05-30',
  status: 'ACTIVE',
  activityCount: null,
  doneCount: null,
  allocatedBudget: null,
}

function errorsOf(result: ReturnType<ReturnType<typeof makeSiteSchema>['safeParse']>) {
  return result.success ? [] : result.error.issues.map((issue) => [issue.path[0], issue.message])
}

describe('site form schema', () => {
  const schema = makeSiteSchema(v)

  it('requires a name of at most 160 characters and an address of at most 255', () => {
    expect(errorsOf(schema.safeParse({ ...blank, name: '   ' }))).toEqual([['name', v.nameRequired]])
    expect(errorsOf(schema.safeParse({ ...blank, name: 'x'.repeat(161) }))).toEqual([['name', v.nameMax]])
    expect(errorsOf(schema.safeParse({ ...blank, address: 'x'.repeat(256) }))).toEqual([['address', v.addressMax]])
    expect(schema.safeParse(blank).success).toBe(true)
  })

  it('rejects an expected end date before the start date, on the end date field', () => {
    const result = schema.safeParse({ ...blank, startDate: '2027-01-10', expectedEndDate: '2027-01-09' })
    expect(errorsOf(result)).toEqual([['expectedEndDate', v.dateOrder]])
  })

  it('accepts the same day, either date alone, or no dates', () => {
    expect(schema.safeParse({ ...blank, startDate: '2027-01-10', expectedEndDate: '2027-01-10' }).success).toBe(true)
    expect(schema.safeParse({ ...blank, expectedEndDate: '2027-01-10' }).success).toBe(true)
    expect(schema.safeParse({ ...blank, startDate: '2027-01-10' }).success).toBe(true)
  })

  it('on edit, refuses to remove a date that is already set', () => {
    const edit = makeSiteSchema(v, site)
    const result = edit.safeParse({ ...siteToValues(site), startDate: '' })
    expect(errorsOf(result)).toEqual([['startDate', v.dateKeep]])
  })
})

describe('buildSitePatch', () => {
  it('sends only the fields that changed', () => {
    const values = { ...siteToValues(site), name: ' Torre Sur ', status: 'ON_HOLD' }
    expect(buildSitePatch(site, values)).toEqual({ name: 'Torre Sur', status: 'ON_HOLD' })
  })

  it('sends an empty address to clear it', () => {
    expect(buildSitePatch(site, { ...siteToValues(site), address: '  ' })).toEqual({ address: '' })
  })

  it('sends nothing when nothing changed', () => {
    expect(buildSitePatch(site, siteToValues(site))).toEqual({})
  })

  it('sets a date that was empty before', () => {
    const bare = { ...site, startDate: null }
    expect(buildSitePatch(bare, { ...siteToValues(bare), startDate: '2026-10-01' })).toEqual({ startDate: '2026-10-01' })
  })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { makeSiteSchema } from '../../../features/sites/siteForm'
import { siteTourValues } from '../../../features/sites/siteTourValues'

const originalTimeZone = process.env.TZ
afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe('siteTourValues', () => {
  it('provides editable example names and distinct valid addresses in both locales', () => {
    const en = siteTourValues('en', '2026-11-22')
    const es = siteTourValues('es', '2026-11-22')
    expect(en.name).toBe('Lomas House')
    expect(es.name).toBe('Casa Lomas')
    expect(en.address).toBe('214 Hillside Ave, San Antonio, TX 78209')
    expect(es.address).toBe('Av. de las Lomas 214, Col. Lomas del Valle, 66256 San Pedro Garza García, N.L.')
    for (const address of [en.address, es.address]) {
      expect(address.length).toBeGreaterThan(0)
      expect(address.length).toBeLessThanOrEqual(200)
    }
    expect(en.address).not.toBe(es.address)
  })

  it.each([
    ['2026-11-22', '2027-02-22'],
    ['2026-01-31', '2026-04-30'],
    ['2027-11-30', '2028-02-29'],
  ])('uses given date %s and clamps its three-month end to %s', (today, end) => {
    for (const locale of ['en', 'es'] as const) {
      expect(siteTourValues(locale, today)).toMatchObject({ startDate: today, expectedEndDate: end, status: '' })
    }
  })

  it('produces values accepted by the Site form schema', () => {
    const messages = { nameRequired: 'required', nameMax: 'too long', addressMax: 'too long', dateOrder: 'date order', dateKeep: 'keep date' }
    for (const locale of ['en', 'es'] as const) {
      expect(makeSiteSchema(messages).safeParse(siteTourValues(locale, '2026-11-22')).success).toBe(true)
    }
  })

  it('does not change with the time zone', () => {
    process.env.TZ = 'America/Mexico_City'
    const mexico = siteTourValues('en', '2026-11-22')
    process.env.TZ = 'Asia/Tokyo'
    expect(siteTourValues('en', '2026-11-22')).toEqual(mexico)
  })
})

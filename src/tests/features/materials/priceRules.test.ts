import { describe, expect, it } from 'bun:test'
import { messages } from '../../../i18n/messages'
import { CURRENCY, daysSince, isStale, localToday, matchesQuery, moneyText, priceRows, relativeAge } from '../../../features/materials/priceRules'

const today = '2026-10-27'

describe('price age', () => {
  it('daysSince: counts calendar days between two ISO dates', () => {
    expect(daysSince('2026-10-15', today)).toBe(12)
    expect(daysSince(today, today)).toBe(0)
    expect(daysSince('2025-10-27', today)).toBe(365)
  })

  it('isStale: exactly 90 days is not stale, 91 is', () => {
    expect(isStale('2026-07-29', today)).toBe(false)
    expect(isStale('2026-07-28', today)).toBe(true)
  })

  it('relativeAge: says how long ago a price was seen, in the user language', () => {
    expect(relativeAge('2026-10-15', today, 'en')).toBe('12 days ago')
    expect(relativeAge('2026-10-15', today, 'es')).toBe('hace 12 días')
    expect(relativeAge(today, today, 'en')).toBe('today')
    expect(relativeAge('2026-10-26', today, 'es')).toBe('ayer')
  })

  it('relativeAge: switches to months after 60 days and to years after a year', () => {
    expect(relativeAge('2026-07-28', today, 'en')).toBe('3 months ago')
    expect(relativeAge('2024-10-27', today, 'en')).toBe('2 years ago')
  })

  it('localToday: is the local calendar date, not UTC', () => {
    expect(localToday(new Date(2026, 9, 27, 23, 30))).toBe('2026-10-27')
    expect(localToday(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
})

describe('money', () => {
  it('moneyText: formats a decimal string in the global currency (USD) with two decimals', () => {
    expect(CURRENCY).toBe('USD')
    expect(moneyText('245.5', 'en')).toBe('$245.50')
    expect(moneyText('1245.50', 'es')).toBe('$1,245.50')
  })

  it('no copy still names the old currency', () => {
    for (const locale of ['en', 'es'] as const) {
      const text = JSON.stringify(messages[locale])
      expect(text).not.toContain('MXN')
      expect(text).not.toMatch(/pesos/i)
      expect(text).toContain(CURRENCY)
    }
  })
})

describe('search', () => {
  it('matchesQuery: contains over name and brand, ignoring case, accents and extra spaces', () => {
    const material = { name: 'Varilla corrugada', brand: 'Ternium' }
    expect(matchesQuery(material, '')).toBe(true)
    expect(matchesQuery(material, '  VARILLA  ')).toBe(true)
    expect(matchesQuery(material, 'tern')).toBe(true)
    expect(matchesQuery({ name: 'Tubería PVC', brand: null }, 'tuberia')).toBe(true)
    expect(matchesQuery(material, 'cemento')).toBe(false)
  })
})

describe('latest price rows', () => {
  const entry = {
    id: 'o-1',
    materialId: 'm-1',
    supplierId: 's-1',
    supplierName: 'Home Depot',
    supplierBranch: null,
    price: '245.50',
    observedOn: '2026-10-01',
    sku: null,
    source: 'MANUAL' as const,
    createdAt: '2026-10-01T18:00:00Z',
    cheapest: true,
  }

  it('priceRows: keeps the server order, highlights every cheapest entry and flags stale ones', () => {
    const rows = priceRows(
      [
        entry,
        { ...entry, id: 'o-2', supplierId: 's-2', cheapest: true },
        { ...entry, id: 'o-3', supplierId: 's-3', price: '260.00', observedOn: '2026-06-01', cheapest: false },
      ],
      today,
    )

    expect(rows.map((row) => [row.id, row.cheapest, row.stale])).toEqual([
      ['o-1', true, false],
      ['o-2', true, false],
      ['o-3', false, true],
    ])
  })

  it('priceRows: highlights no entry when there is only one supplier', () => {
    expect(priceRows([entry], today)[0].cheapest).toBe(false)
  })
})

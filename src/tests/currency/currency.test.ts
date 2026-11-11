import { describe, expect, test } from 'bun:test'
import { fetchExchangeRate, isFresh, parseCachedRate } from '../../currency/exchangeRate'
import { activeCurrency, formatMoney, fromMxn, resolveCurrency, toMxn } from '../../currency/money'

const rate = { mxnPerUsd: 20, date: '2026-11-10' }

describe('money', () => {
  test('formats pesos with grouping and two decimals', () => {
    expect(formatMoney(1234567.891, 'MXN', null)).toBe('$1,234,567.89')
    expect(formatMoney('245.5', 'MXN', rate)).toBe('$245.50')
    expect(formatMoney(-1500, 'MXN', null)).toBe('-$1,500.00')
  })

  test('formats dollars from pesos with a distinct symbol', () => {
    expect(formatMoney(2000, 'USD', rate)).toBe('US$100.00')
  })

  test('converts both ways rounded to cents', () => {
    expect(fromMxn(100, 'USD', rate)).toBe(5)
    expect(toMxn(1.234, 'USD', rate)).toBe(24.68)
    expect(toMxn(10.5, 'MXN', rate)).toBe(10.5)
  })

  test('USD only applies once a rate is known', () => {
    expect(activeCurrency('USD', null)).toBe('MXN')
    expect(activeCurrency('USD', rate)).toBe('USD')
    expect(resolveCurrency('EUR')).toBe('MXN')
    expect(resolveCurrency('USD')).toBe('USD')
  })
})

describe('exchange rate', () => {
  test('reads the latest MXN quote', async () => {
    const fake = (async () =>
      new Response(JSON.stringify([{ date: '2026-11-10', base: 'USD', quote: 'MXN', rate: 18.55 }]))) as unknown as typeof fetch
    expect(await fetchExchangeRate(fake)).toEqual({ mxnPerUsd: 18.55, date: '2026-11-10' })
  })

  test('rejects a failed response', async () => {
    const fake = (async () => new Response('', { status: 500 })) as unknown as typeof fetch
    expect(fetchExchangeRate(fake)).rejects.toThrow()
  })

  test('ignores a malformed cache and keeps a rate for a day', () => {
    expect(parseCachedRate('nope')).toBeNull()
    expect(parseCachedRate(JSON.stringify({ mxnPerUsd: -1, date: 'x', fetchedAt: 0 }))).toBeNull()
    const cached = parseCachedRate(JSON.stringify({ mxnPerUsd: 18, date: '2026-11-10', fetchedAt: 1000 }))!
    expect(isFresh(cached, 1000 + 60_000)).toBe(true)
    expect(isFresh(cached, 1000 + 25 * 60 * 60 * 1000)).toBe(false)
  })
})

/** Every amount is stored in MXN; USD is only a way of showing and typing it. */
export const currencies = ['MXN', 'USD'] as const

export type Currency = (typeof currencies)[number]

/** Pesos per dollar on a given day (YYYY-MM-DD). */
export type ExchangeRate = { mxnPerUsd: number; date: string }

export const CURRENCY_STORAGE_KEY = 'construx.currency'

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (currencies as readonly string[]).includes(value)
}

/** The saved choice, or MXN. */
export function resolveCurrency(saved: string | null): Currency {
  return isCurrency(saved) ? saved : 'MXN'
}

/** Dollars only once a rate is known; until then everything stays in pesos. */
export function activeCurrency(preferred: Currency, rate: ExchangeRate | null): Currency {
  return preferred === 'USD' && rate ? 'USD' : 'MXN'
}

/** Pesos in one unit of `currency`. */
function pesosPerUnit(currency: Currency, rate: ExchangeRate | null): number {
  return currency === 'USD' && rate ? rate.mxnPerUsd : 1
}

function cents(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** A stored peso amount in `currency`, rounded to cents. */
export function fromMxn(amountMxn: number, currency: Currency, rate: ExchangeRate | null): number {
  return cents(amountMxn / pesosPerUnit(currency, rate))
}

/** An amount typed in `currency` as the pesos the API stores, rounded to cents. */
export function toMxn(amount: number, currency: Currency, rate: ExchangeRate | null): number {
  return cents(amount * pesosPerUnit(currency, rate))
}

/** Turns amounts typed in the active currency into stored pesos and back; `useCurrency()` is one. */
export type MoneyConversion = {
  toMxn: (amount: number) => number
  fromMxn: (amountMxn: number) => number
}

/** No conversion: what pure rules default to, and what tests use. */
export const PESOS: MoneyConversion = { toMxn: (amount) => amount, fromMxn: (amountMxn) => amountMxn }

/** The prefix a money field shows: dollars get "US$" so they never pass for pesos. */
export const currencySymbol: Record<Currency, string> = { MXN: '$', USD: 'US$' }

const grouped = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "$1,234,567.89" or "US$66,543.21" in both languages; the input is always pesos. */
export function formatMoney(amountMxn: number | string, currency: Currency, rate: ExchangeRate | null): string {
  const amount = fromMxn(Number(amountMxn), currency, rate)
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currencySymbol[currency]}${grouped.format(Math.abs(amount))}`
}

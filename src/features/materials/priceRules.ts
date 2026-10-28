import { intlLocales, type Locale } from '../../i18n'
import type { LatestPrice, Material } from './pricingApi'

/** A price older than this many days is shown as stale. */
export const STALE_AFTER_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

function utcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** Whole calendar days from `isoDate` to `today` (both YYYY-MM-DD). */
export function daysSince(isoDate: string, today: string): number {
  return Math.round((utcDay(today) - utcDay(isoDate)) / DAY_MS)
}

/** Stale once more than 90 days old: exactly 90 days is still fresh. */
export function isStale(observedOn: string, today: string): boolean {
  return daysSince(observedOn, today) > STALE_AFTER_DAYS
}

/** "12 days ago" / "hace 12 días"; months after 60 days, years after a year. */
export function relativeAge(observedOn: string, today: string, locale: Locale): string {
  const days = daysSince(observedOn, today)
  const format = new Intl.RelativeTimeFormat(intlLocales[locale], { numeric: 'auto' })
  if (days >= 365) return format.format(-Math.floor(days / 365), 'year')
  if (days > 60) return format.format(-Math.floor(days / 30), 'month')
  return format.format(-days, 'day')
}

/** Today's date in the user's time zone as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Every amount in the app (prices, budgets, expenses) is in this currency for now. */
export const CURRENCY = 'USD'

/** The narrow symbol keeps both languages on "$1,245.50". */
const moneyLocales: Record<Locale, string> = { en: 'en-US', es: 'es-MX' }

/** A decimal string such as "245.5" in the global currency with two decimals. */
export function moneyText(price: string, locale: Locale): string {
  return new Intl.NumberFormat(moneyLocales[locale], {
    style: 'currency',
    currency: CURRENCY,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(price))
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Search over name and brand, ignoring case, accents and repeated spaces. */
export function matchesQuery(material: Pick<Material, 'name' | 'brand'>, search: string): boolean {
  const wanted = normalize(search)
  if (!wanted) return true
  return normalize(`${material.name} ${material.brand ?? ''}`).includes(wanted)
}

export type PriceRow = LatestPrice & { stale: boolean }

/**
 * Latest prices as shown: the server's order (cheapest first) and its `cheapest`
 * flag, which is only highlighted when there is more than one supplier to compare.
 */
export function priceRows(latestPrices: LatestPrice[], today: string): PriceRow[] {
  const compare = latestPrices.length > 1
  return latestPrices.map((price) => ({
    ...price,
    cheapest: compare && price.cheapest,
    stale: isStale(price.observedOn, today),
  }))
}

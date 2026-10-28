import type { Locale, Messages } from '../../i18n'
import { supplierLabel } from './materialDisplay'
import { moneyText, priceRows, relativeAge } from './priceRules'
import type { LatestPrice } from './pricingApi'

type LatestPricesProps = {
  prices: LatestPrice[]
  today: string
  t: Messages['materials']
  locale: Locale
}

/** Latest price per supplier, cheapest first; the cheapest is highlighted and old prices are flagged. */
export function LatestPrices({ prices, today, t, locale }: LatestPricesProps) {
  if (prices.length === 0) return <span className="cell-muted">{t.noPrices}</span>

  return (
    <ul className="price-list">
      {priceRows(prices, today).map((row) => (
        <li key={row.id} className="price-list__row" data-cheapest={row.cheapest || undefined}>
          <span className="price-list__supplier">{supplierLabel({ name: row.supplierName, branch: row.supplierBranch })}</span>
          <span className="price-list__price data-mono">{moneyText(row.price, locale)}</span>
          <span className="price-list__age">{relativeAge(row.observedOn, today, locale)}</span>
          {row.cheapest ? (
            <span className="badge" data-tone="success">
              {t.cheapest}
            </span>
          ) : null}
          {row.stale ? (
            <span className="badge" data-tone="warning" title={t.staleHint}>
              {t.stale}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

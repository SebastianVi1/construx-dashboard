import { useEffect, useState, type ReactNode } from 'react'
import { CurrencyContext } from './currency-context'
import { EXCHANGE_RATE_STORAGE_KEY, fetchExchangeRate, isFresh, parseCachedRate } from './exchangeRate'
import {
  activeCurrency,
  CURRENCY_STORAGE_KEY,
  formatMoney,
  fromMxn,
  resolveCurrency,
  toMxn,
  type Currency,
  type ExchangeRate,
} from './money'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

/**
 * The MXN/USD display preference. The rate is only fetched once someone picks USD, then cached
 * for a day; if it cannot be loaded the app keeps showing pesos.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [preferred, setPreferred] = useState<Currency>(() => resolveCurrency(read(CURRENCY_STORAGE_KEY)))
  const [cached] = useState(() => parseCachedRate(read(EXCHANGE_RATE_STORAGE_KEY)))
  const [rate, setRate] = useState<ExchangeRate | null>(cached)
  const [rateFailed, setRateFailed] = useState(false)

  useEffect(() => {
    if (preferred !== 'USD' || (cached && isFresh(cached, Date.now()))) return
    let cancelled = false
    fetchExchangeRate()
      .then((latest) => {
        if (cancelled) return
        write(EXCHANGE_RATE_STORAGE_KEY, JSON.stringify({ ...latest, fetchedAt: Date.now() }))
        setRate(latest)
        setRateFailed(false)
      })
      .catch(() => {
        // An older cached rate is still better than none.
        if (!cancelled) setRateFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [preferred, cached])

  function setCurrency(next: Currency) {
    write(CURRENCY_STORAGE_KEY, next)
    setPreferred(next)
  }

  const currency = activeCurrency(preferred, rate)

  return (
    <CurrencyContext.Provider
      value={{
        preferred,
        currency,
        rate,
        rateUnavailable: preferred === 'USD' && !rate && rateFailed,
        setCurrency,
        money: (amountMxn) => formatMoney(amountMxn, currency, rate),
        fromMxn: (amountMxn) => fromMxn(amountMxn, currency, rate),
        toMxn: (amount) => toMxn(amount, currency, rate),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

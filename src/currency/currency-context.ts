import { createContext, useContext } from 'react'
import type { Currency, ExchangeRate } from './money'

export type CurrencyContextValue = {
  /** What the user picked. */
  preferred: Currency
  /** What the app shows: USD falls back to MXN while there is no rate. */
  currency: Currency
  rate: ExchangeRate | null
  /** True when USD was picked but no rate could be loaded. */
  rateUnavailable: boolean
  setCurrency: (currency: Currency) => void
  /** A stored peso amount as display text, such as "$1,234.50" or "US$66.53". */
  money: (amountMxn: number | string) => string
  /** A stored peso amount in the active currency, rounded to cents. */
  fromMxn: (amountMxn: number) => number
  /** An amount typed in the active currency as pesos, rounded to cents. */
  toMxn: (amount: number) => number
}

export const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined)

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider')
  return context
}

import { formatMessage, intlLocales, useLocale } from '../i18n'
import { useCurrency } from './currency-context'

/** Which rate turns pesos into dollars, and from when; says so when it could not be loaded. Nothing in MXN. */
export function ExchangeRateNote({ className }: { className?: string }) {
  const { currency, rate, rateUnavailable } = useCurrency()
  const { locale, messages: m } = useLocale()

  if (rateUnavailable) return <p className={className}>{m.common.rateUnavailable}</p>
  if (currency !== 'USD' || !rate) return null

  const date = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${rate.date}T00:00:00Z`),
  )
  return (
    <p className={className}>
      {formatMessage(m.common.rateNote, { rate: rate.mxnPerUsd.toFixed(2), date })}
    </p>
  )
}

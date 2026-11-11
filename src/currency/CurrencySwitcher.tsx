import { useLocale } from '../i18n'
import { useCurrency } from './currency-context'
import { currencies } from './money'
import '../components/switcher/segmented-switch.css'

export function CurrencySwitcher() {
  const { preferred, setCurrency } = useCurrency()
  const { messages: m } = useLocale()

  return (
    <div className="segmented-switch" role="group" aria-label={m.common.currency}>
      {currencies.map((code) => (
        <button
          key={code}
          type="button"
          className={preferred === code ? 'is-active' : undefined}
          aria-pressed={preferred === code}
          onClick={() => setCurrency(code)}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

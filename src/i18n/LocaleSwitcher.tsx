import { useLocale } from './locale-context'
import { locales } from './locale'
import './locale-switcher.css'

export function LocaleSwitcher() {
  const { locale, setLocale, messages } = useLocale()

  return (
    <div className="locale-switcher" role="group" aria-label={messages.common.language}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          className={locale === code ? 'is-active' : undefined}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

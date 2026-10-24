import { useEffect, useState, type ReactNode } from 'react'
import { messages } from './messages'
import { resolveLocale, type Locale } from './locale'
import { LocaleContext } from './locale-context'

const STORAGE_KEY = 'construx.locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(localStorage.getItem(STORAGE_KEY), navigator.language),
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, messages: messages[locale] }}>
      {children}
    </LocaleContext.Provider>
  )
}

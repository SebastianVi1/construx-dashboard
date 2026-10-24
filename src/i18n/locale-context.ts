import { createContext, useContext } from 'react'
import type { Messages } from './messages'
import type { Locale } from './locale'

export type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  messages: Messages
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('useLocale must be used within a LocaleProvider')
  return context
}

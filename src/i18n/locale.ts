export const locales = ['en', 'es'] as const

export type Locale = (typeof locales)[number]

/** Intl (ECMA-402) locale used for date/currency formatting per app locale. */
export const intlLocales: Record<Locale, string> = {
  en: 'en-US',
  es: 'es',
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es'
}

/**
 * Resolve the active locale. A saved user override wins; otherwise a browser
 * language starting with `es` selects Spanish and anything else English.
 */
export function resolveLocale(saved: string | null, browserLanguage: string | undefined): Locale {
  if (isLocale(saved)) return saved
  return browserLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

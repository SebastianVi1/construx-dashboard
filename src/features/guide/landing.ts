import type { Locale } from '../../i18n'
import type { GuideChapter } from './catalog'

/**
 * The landing page's long-form guide in each language. Same paths as the
 * landing page's `src/i18n/paths.ts`, trailing slash included so the link
 * lands without a redirect.
 */
const guidePaths: Record<Locale, string> = { es: 'guia/', en: 'en/guide/' }

/**
 * Link to one chapter of the landing guide in the user's language, or null
 * when no landing URL is configured (no link is shown then).
 */
export function landingGuideHref(base: string | null, locale: Locale, chapter: GuideChapter): string | null {
  if (base === null) return null
  return `${base.replace(/\/+$/, '')}/${guidePaths[locale]}#${chapter}`
}

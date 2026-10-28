export const themes = ['light', 'dark'] as const

export type Theme = (typeof themes)[number]

/** Also read by the inline script in index.html, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'construx.theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * Resolve the active theme. A saved user choice wins; otherwise light, because
 * the dashboard is mostly read on phones outdoors, where dark screens wash out.
 */
export function resolveTheme(saved: string | null): Theme {
  return isTheme(saved) ? saved : 'light'
}

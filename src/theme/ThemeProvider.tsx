import { useState, type ReactNode } from 'react'
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from './theme'
import { ThemeContext } from './theme-context'

/** Browser chrome color per theme; matches --cx-canvas in index.css. */
const chromeColor: Record<Theme, string> = {
  light: '#f3f4f1',
  dark: '#060d1a',
}

function readSavedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Writes the theme to the DOM synchronously, so a caller wrapping setTheme in a
 * view transition captures the new look in the same frame.
 */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chromeColor[theme])
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(readSavedTheme()))

  function setTheme(next: Theme) {
    applyTheme(next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

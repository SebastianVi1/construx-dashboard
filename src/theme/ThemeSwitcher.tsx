import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { MoonIcon, SunIcon } from '../components/icons'
import { useLocale } from '../i18n'
import { themes, type Theme } from './theme'
import { useTheme } from './theme-context'
import '../components/switcher/segmented-switch.css'

const icons = { light: SunIcon, dark: MoonIcon }

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const { messages: m } = useLocale()
  const labels: Record<Theme, string> = { light: m.common.themeLight, dark: m.common.themeDark }

  // The new theme washes in as a circle growing from the pressed button.
  function choose(next: Theme, event: MouseEvent<HTMLButtonElement>) {
    if (next === theme) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduceMotion) {
      setTheme(next)
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    const root = document.documentElement.style
    root.setProperty('--cx-reveal-x', `${box.left + box.width / 2}px`)
    root.setProperty('--cx-reveal-y', `${box.top + box.height / 2}px`)
    document.startViewTransition(() => flushSync(() => setTheme(next)))
  }

  return (
    <div className="segmented-switch" role="group" aria-label={m.common.theme}>
      {themes.map((code) => {
        const Icon = icons[code]
        return (
          <button
            key={code}
            type="button"
            className={theme === code ? 'is-active' : undefined}
            aria-pressed={theme === code}
            aria-label={labels[code]}
            title={labels[code]}
            onClick={(event) => choose(code, event)}
          >
            <Icon width="16" height="16" />
          </button>
        )
      })}
    </div>
  )
}

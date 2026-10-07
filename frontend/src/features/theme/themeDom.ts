import type { Theme } from '../../domain/types'
import { THEME_KEY } from '../../storage/migration'

export function loadStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // storage unavailable
  }
  return 'system'
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // storage unavailable: theme stays session-only
  }
}

/** 'system' removes the attribute so the prefers-color-scheme block applies. */
export function applyThemeAttribute(theme: Theme): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

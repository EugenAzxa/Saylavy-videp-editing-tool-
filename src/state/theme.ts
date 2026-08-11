/**
 * Light or dark.
 *
 * Dark is the default, matching saylavy.com. The toggle exists because dark
 * backgrounds are genuinely harder to read for people with cataracts or
 * reduced contrast sensitivity — a large share of this audience — and that is
 * not a reason to withhold the brand look from everyone else. Both themes are
 * held to the same contrast bar; see docs/ACCESSIBILITY.md.
 *
 * The theme is applied to `<html data-theme>` by an inline script in
 * index.html BEFORE first paint, so the page never flashes the wrong colours.
 * This module reads that value back rather than deciding it a second time.
 */

import { create } from 'zustand'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'saylavy-theme'

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private browsing, or storage disabled. The choice simply will not
    // outlive the tab, which is a perfectly acceptable degradation.
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: currentTheme(),
  setTheme: (theme) => {
    apply(theme)
    set({ theme })
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/** Matches `--bg-primary` in tokens-light after warm pass. */
const THEME_COLOR_LIGHT = '#f4f2ef';
const THEME_COLOR_DARK = '#121620';

const STORAGE_KEY = 'wagwan_theme_mode';

function getInitialMode(): 'dark' | 'light' {
  if (!browser) return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

export const themeMode = writable<'dark' | 'light'>(getInitialMode());

export function toggleThemeMode() {
  themeMode.update(m => {
    const next = m === 'dark' ? 'light' : 'dark';
    if (browser) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    }
    return next;
  });
}

/** Syncs `<html data-theme>` and PWA chrome color. */
export function applyThemeToDocument() {
  if (!browser) return;
  document.documentElement.dataset.theme = 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR_DARK);
}

export function syncThemeColor(mode: 'dark' | 'light') {
  if (!browser) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

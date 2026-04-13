import { browser } from '$app/environment';

/** Matches `--bg-primary` in tokens-light after warm pass. */
const THEME_COLOR = '#f4f2ef';

/** Wagwan is light-only; syncs `<html data-theme>` and PWA chrome. */
export function applyThemeToDocument() {
  if (!browser) return;
  document.documentElement.dataset.theme = 'light';
  try {
    localStorage.removeItem('wagwan_theme');
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR);
}

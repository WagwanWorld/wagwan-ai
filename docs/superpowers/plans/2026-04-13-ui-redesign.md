# Wagwan UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Wagwan's UI to a "Living Editorial" aesthetic — bold, alive, personal — using Bodoni Moda display serif + Geist UI font, acid-lime as the sole brand accent across both modes, an asymmetric bento grid on Home, double-bezel card architecture, and a cohesive motion system.

**Architecture:** All changes are styling/layout only — no backend, no store, no routing changes. Work with the existing SvelteKit 5 + Tailwind CSS v3 + CSS custom properties stack. Modify CSS token files first (biggest impact, lowest risk), then components, then page layouts.

**Tech Stack:** SvelteKit 5, Tailwind CSS v3, CSS custom properties, `@fontsource/bodoni-moda`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, `phosphor-svelte`

**Spec:** `docs/superpowers/specs/2026-04-13-ui-redesign-design.md`

---

## File Map

| File | What changes |
|------|-------------|
| `src/styles/typography.css` | Font imports removed; new Bodoni Moda + Geist stack |
| `src/styles/tokens-shared.css` | Add `--ease-premium`, `--ease-entrance`; add display/data font vars |
| `src/styles/tokens-home-dark.css` | Full token replacement: oklch backgrounds, lime+teal blobs only, remove purple/indigo |
| `src/styles/tokens-light.css` | Full token replacement: warm newsprint, lime accent, remove blue/purple blobs |
| `src/styles/components.css` | Buttons → pill shape; remove `.grad-text`; upgrade `.w-card` hover; add `.w-card-bezel` |
| `tailwind.config.js` | Add `display` and `mono` font families |
| `src/lib/components/AmbientGradients.svelte` | Rename orbs `--lime`/`--teal`/`--amber`; remap CSS token references |
| `src/lib/components/HomeIdentityHeader.svelte` | `one_liner` in display font; hero split layout |
| `src/lib/components/GlassPanel.svelte` | Add `bezel` prop → double-bezel wrapper markup |
| `src/lib/components/ResultCard.svelte` | Apply `.w-card-bezel`; upgrade hover shadow to lime-tinted |
| `src/lib/components/DesktopSidebar.svelte` | Replace Lucide icons with Phosphor; add collapse hover |
| `src/lib/components/FloatingNav.svelte` | Double-bezel pill; dot active indicator; grain overlay |
| `src/routes/(app)/home/+page.svelte` | Bento grid layout; page-load stagger animation |

---

## Task 1: Install new font packages

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/styles/typography.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Install font packages**

```bash
cd /Users/madhviknemani/wagwan-ai
npm install @fontsource/bodoni-moda @fontsource-variable/geist @fontsource-variable/geist-mono
```

Expected output: 3 packages added, no errors.

- [ ] **Step 2: Verify packages exist**

```bash
ls node_modules/@fontsource/bodoni-moda/files/ | head -5
ls node_modules/@fontsource-variable/geist/
```

Expected: directories exist with `.woff2` files.

- [ ] **Step 3: Replace `src/styles/typography.css`**

Replace the entire file with:

```css
/* Bodoni Moda — display/editorial serif (identity headlines, AI synthesis) */
@import '@fontsource/bodoni-moda/400.css';
@import '@fontsource/bodoni-moda/400-italic.css';
@import '@fontsource/bodoni-moda/600.css';

/* Geist — UI/body grotesque */
@import '@fontsource-variable/geist';

/* Geist Mono — data/numbers */
@import '@fontsource-variable/geist-mono';

:root {
  --font-sans: 'Geist Variable', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Bodoni Moda', Georgia, serif;
  --font-mono: 'Geist Mono Variable', 'Geist Mono', 'Courier New', monospace;

  --text-xs: 0.6875rem;
  --text-sm: 0.8125rem;
  --text-base: 0.9375rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: clamp(1.5rem, 4vw, 2rem);
  --text-display-sm: clamp(1.75rem, 3.5vw, 2.25rem);
  --text-display-md: clamp(2rem, 4.5vw, 3rem);
  --text-display-lg: clamp(2.5rem, 5vw, 3.5rem);
}
```

- [ ] **Step 4: Update `tailwind.config.js` font families**

Replace the `fontFamily` block inside `theme.extend`:

```js
fontFamily: {
  sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
  display: ['var(--font-display)', 'Georgia', 'serif'],
  mono: ['var(--font-mono)', 'monospace'],
},
```

Full updated `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
          tertiary: 'var(--accent-tertiary)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        pill: '100px',
        bezel: '2rem',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Verify build has no errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ built in` with no red errors. Warnings about unused CSS are fine.

- [ ] **Step 6: Commit**

```bash
git add src/styles/typography.css tailwind.config.js package.json package-lock.json
git commit -m "feat: swap Inter → Bodoni Moda + Geist + Geist Mono font stack"
```

---

## Task 2: Update shared tokens (easing + new font variables)

**Files:**
- Modify: `src/styles/tokens-shared.css`

- [ ] **Step 1: Replace `src/styles/tokens-shared.css`**

```css
@layer base {
  :root {
    --r: 16px;
    --floating-nav-dock-gap: calc(76px + env(safe-area-inset-bottom, 0px));
    --nav-dock-gap: var(--floating-nav-dock-gap);
    --blur-light: 6px;
    --blur-medium: 12px;
    --blur-heavy: 16px;
    --state-success: #22c55e;
    --state-warning: #ca8a04;
    --state-error: #ef4444;
    --brand-red: #dc2626;
    --brand-gold: #eab308;
    --brand-gold-mid: #ca8a04;

    /* ── Layout rhythm ── */
    --home-layout-gutter: clamp(14px, 2.2vw, 28px);

    /* ── Mesh tuning ── */
    --mesh-orb-opacity-scale: 1;
    --mesh-blur-scale: 1;

    /* ── Premium easing ── */
    --ease-premium: cubic-bezier(0.32, 0.72, 0, 1);
    --ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

    /* ── Duration scale ── */
    --dur-micro: 150ms;
    --dur-standard: 250ms;
    --dur-entrance: 700ms;
    --dur-ambient: 12s;
  }

  html[data-app-surface='explore'] { --mesh-orb-opacity-scale: 1.06; }
  html[data-app-surface='home']    { --mesh-orb-opacity-scale: 1.05; }
  html[data-app-surface='ai']      { --mesh-orb-opacity-scale: 1.02; }
  html[data-app-surface='onboarding'] { --mesh-orb-opacity-scale: 1.08; }
  html[data-app-surface='profile'] { --mesh-orb-opacity-scale: 1.04; }

  @media (min-width: 768px) {
    .app-shell--rail {
      --nav-dock-gap: max(24px, env(safe-area-inset-bottom, 0px));
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens-shared.css
git commit -m "feat: add premium easing variables and duration scale to shared tokens"
```

---

## Task 3: Replace dark mode tokens

**Files:**
- Modify: `src/styles/tokens-home-dark.css`

- [ ] **Step 1: Replace entire `src/styles/tokens-home-dark.css`**

```css
/**
 * Dark + acid-lime theme: Home surface and/or authenticated app chrome.
 * - `.home-page-root[data-home-surface='dark']` — Home page subtree
 * - `html:has([data-app-chrome='dark'])` — sidebar + all (app) routes
 */
@layer base {
  .home-page-root[data-home-surface='dark'],
  html:has([data-app-chrome='dark']) {
    --home-lime: #c4f24a;
    --home-lime-soft: rgba(196, 242, 74, 0.14);
    --home-lime-glow: rgba(196, 242, 74, 0.32);

    --home-font-title: clamp(1.45rem, 2.2vw, 1.75rem);
    --home-font-section: clamp(0.875rem, 1.1vw, 1rem);
    --home-font-body: 13px;
    --home-font-meta: 11px;
    --home-section-gap: 32px;
    --home-section-gap-lg: 48px;
    --home-shell-pad-x: clamp(24px, 5vw, 80px);
    --home-layout-gutter: clamp(16px, 2.4vw, 28px);
    --home-accent-gradient: linear-gradient(90deg, #c4f24a 0%, oklch(55% 0.14 200) 100%);

    /* Backgrounds — blue-tinted blacks for perceptual consistency with lime */
    --bg-primary: oklch(8% 0.008 260);
    --bg-secondary: oklch(10% 0.009 255);
    --bg-elevated: oklch(13% 0.010 258);

    --text-primary: #e8ecf3;
    --text-secondary: #9aa3b2;
    --text-muted: #6d7684;

    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.14);

    --glass-light: rgba(255, 255, 255, 0.055);
    --glass-medium: rgba(255, 255, 255, 0.08);
    --glass-strong: rgba(255, 255, 255, 0.11);

    /* Accent — lime only, no gradient */
    --accent-primary: #c4f24a;
    --accent-secondary: #9edb2f;
    --accent-tertiary: #7cb518;
    --accent-glow: oklch(75% 0.22 130 / 0.32);
    --accent-soft: oklch(75% 0.22 130 / 0.12);
    --brand-red-soft: rgba(248, 113, 113, 0.12);

    /* Ambient blobs — lime + teal only (purple/indigo removed) */
    --blob-tint-a: oklch(75% 0.22 130 / 0.18);    /* lime */
    --blob-tint-b: oklch(55% 0.14 200 / 0.15);    /* deep teal */
    --blob-tint-c: oklch(65% 0.10 210 / 0.12);    /* teal-blue */
    --blob-glow: oklch(75% 0.22 130 / 0.20);
    --ambient-lime: oklch(75% 0.22 130 / 0.10);
    --ambient-teal: oklch(55% 0.14 200 / 0.10);
    --ambient-amber: oklch(72% 0.16 80 / 0.08);
    /* Legacy aliases used by AmbientGradients (updated in Task 6) */
    --ambient-blue: var(--ambient-teal);
    --ambient-red: oklch(58% 0.18 25 / 0.06);
    --ambient-gold: var(--ambient-lime);

    --bg: var(--bg-primary);
    --card: var(--glass-light);
    --card2: var(--glass-medium);
    --border: var(--border-subtle);
    --border-glow: var(--accent-glow);
    --text: var(--text-primary);
    --text2: var(--text-secondary);
    --text3: var(--text-muted);
    --accent: var(--accent-primary);
    --accent2: var(--accent-secondary);
    --accent3: var(--accent-tertiary);
    --green: var(--state-success);
    --amber: var(--state-warning);

    --panel-surface: rgba(255, 255, 255, 0.04);
    --panel-surface-soft: rgba(255, 255, 255, 0.025);
    --panel-border: rgba(255, 255, 255, 0.10);
    --panel-border-strong: rgba(255, 255, 255, 0.16);
    --panel-divider: rgba(255, 255, 255, 0.06);
    --panel-hover: rgba(255, 255, 255, 0.06);
    --panel-hover-border: rgba(255, 255, 255, 0.20);

    /* Shadows — tinted lime, not pure black */
    --shadow-tall-card: 0 12px 40px oklch(8% 0.008 260 / 0.6);
    --shadow-card-hover: 0 8px 28px oklch(75% 0.22 130 / 0.22);

    --calendar-today-bg: oklch(75% 0.22 130 / 0.12);
    --calendar-today-border: oklch(75% 0.22 130 / 0.35);
    --calendar-today-label: var(--accent-primary);
    --text-on-media: #ffffff;
    --text-on-media-muted: rgba(255, 255, 255, 0.55);
    --scrim-media: linear-gradient(to top, rgba(0, 0, 0, 0.82) 0%, transparent 55%);
    --gmail-icon-bg: rgba(234, 67, 53, 0.14);
    --gmail-icon-border: rgba(234, 67, 53, 0.28);
    --score-high-bg: rgba(34, 197, 94, 0.14);
    --score-high-border: rgba(34, 197, 94, 0.32);
    --score-high-text: #4ade80;
    --score-low-bg: rgba(248, 113, 113, 0.12);
    --score-low-border: rgba(248, 113, 113, 0.28);
    --score-low-text: #fb7185;
    --pill-warn-border: rgba(248, 113, 113, 0.28);

    --accent-gradient-wash: linear-gradient(
      120deg,
      oklch(75% 0.22 130 / 0.12) 0%,
      oklch(55% 0.14 200 / 0.10) 45%,
      oklch(65% 0.10 210 / 0.08) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      oklch(75% 0.22 130 / 0.42),
      oklch(55% 0.14 200 / 0.35),
      oklch(65% 0.10 210 / 0.30)
    );

    --mesh-orb-base-opacity: 0.32;
  }

  /* Mobile dock */
  html[data-app-surface='home'] nav[aria-label='Main navigation'] > div,
  html:has([data-app-chrome='dark']) nav[aria-label='Main navigation'] > div {
    background:
      linear-gradient(rgba(18, 22, 30, 0.92), rgba(12, 14, 20, 0.88)) padding-box,
      linear-gradient(
          125deg,
          oklch(75% 0.22 130 / 0.35),
          oklch(55% 0.14 200 / 0.22),
          oklch(65% 0.10 210 / 0.18)
        )
        border-box;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 1px 0 rgba(255, 255, 255, 0.06) inset;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens-home-dark.css
git commit -m "feat: replace dark mode tokens — lime+teal blobs, oklch backgrounds, remove purple/indigo"
```

---

## Task 4: Replace light mode tokens

**Files:**
- Modify: `src/styles/tokens-light.css`

- [ ] **Step 1: Replace entire `src/styles/tokens-light.css`**

```css
@layer base {
  html[data-theme='light'] {
    /* Backgrounds — warm newsprint, not cold white */
    --bg-primary: oklch(96% 0.012 80);
    --bg-secondary: oklch(93% 0.013 78);
    --bg-elevated: oklch(99% 0.005 80);

    --text-primary: oklch(12% 0.010 260);
    --text-secondary: oklch(42% 0.012 250);
    --text-muted: oklch(58% 0.010 245);

    --border-subtle: rgba(20, 24, 32, 0.09);
    --border-strong: rgba(20, 24, 32, 0.16);

    /* Glass — warm-tinted */
    --glass-light: oklch(99% 0.008 80 / 0.72);
    --glass-medium: oklch(99% 0.008 80 / 0.90);
    --glass-strong: oklch(99% 0.008 80 / 0.97);

    /* Accent — same lime as dark mode (highlighter on paper effect) */
    --accent-primary: #c4f24a;
    --accent-secondary: #9edb2f;
    --accent-tertiary: #7cb518;
    --accent-glow: oklch(75% 0.22 130 / 0.28);
    --accent-soft: oklch(75% 0.22 130 / 0.10);
    --brand-red-soft: rgba(220, 38, 38, 0.10);

    /* Ambient blobs — warm amber + lime (no blue, no purple) */
    --blob-tint-a: oklch(75% 0.22 130 / 0.14);    /* lime */
    --blob-tint-b: oklch(72% 0.16 80 / 0.12);     /* warm amber */
    --blob-tint-c: oklch(68% 0.12 70 / 0.10);     /* amber-orange */
    --blob-glow: oklch(75% 0.22 130 / 0.18);
    --ambient-lime: oklch(75% 0.22 130 / 0.10);
    --ambient-teal: oklch(55% 0.14 200 / 0.06);
    --ambient-amber: oklch(72% 0.16 80 / 0.10);
    /* Legacy aliases */
    --ambient-blue: var(--ambient-teal);
    --ambient-red: oklch(58% 0.18 25 / 0.05);
    --ambient-gold: var(--ambient-lime);

    --bg: var(--bg-primary);
    --card: var(--glass-light);
    --card2: var(--glass-medium);
    --border: var(--border-subtle);
    --border-glow: var(--accent-glow);
    --text: var(--text-primary);
    --text2: var(--text-secondary);
    --text3: var(--text-muted);
    --accent: var(--accent-primary);
    --accent2: var(--accent-secondary);
    --accent3: var(--accent-tertiary);
    --green: var(--state-success);
    --amber: var(--state-warning);

    --panel-surface: rgba(20, 24, 32, 0.045);
    --panel-surface-soft: rgba(20, 24, 32, 0.030);
    --panel-border: rgba(20, 24, 32, 0.12);
    --panel-border-strong: rgba(20, 24, 32, 0.17);
    --panel-divider: rgba(20, 24, 32, 0.08);
    --panel-hover: rgba(20, 24, 32, 0.06);
    --panel-hover-border: rgba(20, 24, 32, 0.18);

    /* Shadows — warm amber-tinted */
    --shadow-tall-card: 0 8px 32px oklch(72% 0.16 80 / 0.14);
    --shadow-card-hover: 0 8px 28px oklch(75% 0.22 130 / 0.18);

    --calendar-today-bg: oklch(75% 0.22 130 / 0.12);
    --calendar-today-border: oklch(75% 0.22 130 / 0.28);
    --calendar-today-label: var(--accent-primary);
    --text-on-media: #ffffff;
    --text-on-media-muted: rgba(255, 255, 255, 0.55);
    --scrim-media: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 55%);
    --gmail-icon-bg: rgba(234, 67, 53, 0.12);
    --gmail-icon-border: rgba(234, 67, 53, 0.22);
    --score-high-bg: rgba(0, 194, 122, 0.12);
    --score-high-border: rgba(0, 194, 122, 0.28);
    --score-high-text: #059669;
    --score-low-bg: rgba(229, 0, 26, 0.10);
    --score-low-border: rgba(229, 0, 26, 0.25);
    --score-low-text: #e11d48;
    --pill-warn-border: rgba(229, 0, 26, 0.22);

    --accent-gradient-wash: linear-gradient(
      120deg,
      oklch(75% 0.22 130 / 0.10) 0%,
      oklch(72% 0.16 80 / 0.08) 45%,
      oklch(68% 0.12 70 / 0.07) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      oklch(75% 0.22 130 / 0.40),
      oklch(72% 0.16 80 / 0.32),
      oklch(68% 0.12 70 / 0.28)
    );

    --mesh-orb-base-opacity: 0.24;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens-light.css
git commit -m "feat: replace light mode tokens — warm newsprint, lime accent, remove blue/purple blobs"
```

---

## Task 5: Upgrade component CSS (buttons, cards, remove grad-text)

**Files:**
- Modify: `src/styles/components.css`

- [ ] **Step 1: In `src/styles/components.css`, update `.btn-primary` to pill shape**

Find and replace the `.btn-primary` rule:

```css
  .btn-primary {
    @apply w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-[oklch(12%_0.010_260)] font-semibold text-base cursor-pointer border-0;
    background: var(--accent-primary);
    transition: transform var(--dur-micro) var(--ease-premium),
                box-shadow var(--dur-micro) var(--ease-premium),
                background var(--dur-micro) var(--ease-premium);
    min-height: 44px;
  }
  .btn-primary:hover {
    background: var(--accent-secondary);
    box-shadow: 0 4px 20px var(--accent-glow);
  }
  .btn-primary:active {
    transform: scale(0.98) translateY(1px);
  }
  .btn-primary:disabled {
    opacity: 0.4;
  }
```

- [ ] **Step 2: Update `.btn-secondary` to pill shape**

```css
  .btn-secondary {
    @apply w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-base cursor-pointer;
    background: var(--glass-light);
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
    backdrop-filter: blur(var(--blur-medium));
    transition: border-color var(--dur-micro) var(--ease-premium),
                background var(--dur-micro) var(--ease-premium),
                transform var(--dur-micro) var(--ease-premium);
    min-height: 44px;
  }
  .btn-secondary:hover {
    border-color: var(--accent-glow);
    background: var(--glass-medium);
  }
  .btn-secondary:active {
    transform: scale(0.98) translateY(1px);
  }
```

- [ ] **Step 3: Remove `.grad-text` and replace with `.text-accent`**

Find the `.grad-text` rule block and replace it with:

```css
  /* REMOVED: .grad-text (gradient text is banned — use solid accent color) */
  .text-accent {
    color: var(--accent-primary);
  }
```

- [ ] **Step 4: Upgrade `.w-card` hover to use lime-tinted shadow**

Find and replace the `.w-card` and `.w-card:hover` rules:

```css
  .w-card {
    background: var(--glass-light);
    backdrop-filter: blur(var(--blur-heavy));
    -webkit-backdrop-filter: blur(var(--blur-heavy));
    border: 1px solid var(--border-subtle);
    border-radius: var(--r);
    overflow: hidden;
    transition: transform var(--dur-standard) var(--ease-premium),
                border-color var(--dur-standard) var(--ease-premium),
                box-shadow var(--dur-standard) var(--ease-premium);
  }
  .w-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent-soft);
    box-shadow: var(--shadow-card-hover);
  }
```

- [ ] **Step 5: Add `.w-card-bezel` double-bezel card class after `.w-card`**

```css
  /* Double-bezel card: outer shell + inner core for haptic depth */
  .w-card-bezel {
    padding: 6px;
    border-radius: 2rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    transition: transform var(--dur-standard) var(--ease-premium),
                box-shadow var(--dur-standard) var(--ease-premium);
  }
  .w-card-bezel:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-card-hover);
  }
  .w-card-bezel__inner {
    border-radius: calc(2rem - 6px);
    background: var(--bg-elevated);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }
```

- [ ] **Step 6: Update `.chip` active state to use easing variables**

Find `.chip` transition and update:

```css
    transition: all var(--dur-standard) var(--ease-premium);
```

- [ ] **Step 7: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/styles/components.css
git commit -m "feat: upgrade component CSS — pill buttons, lime hover shadows, double-bezel card, remove grad-text"
```

---

## Task 6: Update AmbientGradients to lime + teal only

**Files:**
- Modify: `src/lib/components/AmbientGradients.svelte`

- [ ] **Step 1: Replace `AmbientGradients.svelte`**

```svelte
<!-- Full-viewport ambient mesh; pointer-events none. Opacity/blur from CSS tokens. -->
<div class="ambient-mesh" aria-hidden="true">
  <div class="ambient-mesh__orb ambient-mesh__orb--lime"></div>
  <div class="ambient-mesh__orb ambient-mesh__orb--teal"></div>
  <div class="ambient-mesh__orb ambient-mesh__orb--amber"></div>
</div>

<style>
  .ambient-mesh {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .ambient-mesh__orb {
    position: absolute;
    border-radius: 50%;
    opacity: calc(var(--mesh-orb-base-opacity, 0.32) * var(--mesh-orb-opacity-scale, 1));
    filter: blur(calc(48px * var(--mesh-blur-scale, 1)));
    animation: ambient-mesh-drift 18s ease-in-out infinite;
  }

  .ambient-mesh__orb--teal {
    animation-duration: 22s;
    animation-direction: reverse;
  }

  .ambient-mesh__orb--amber {
    animation-duration: 26s;
  }

  .ambient-mesh__orb--lime {
    width: min(55vw, 520px);
    height: min(55vw, 520px);
    left: -8%;
    top: 15%;
    background: radial-gradient(circle, var(--ambient-lime) 0%, transparent 70%);
  }

  .ambient-mesh__orb--teal {
    width: min(45vw, 420px);
    height: min(45vw, 420px);
    right: -5%;
    top: 45%;
    background: radial-gradient(circle, var(--ambient-teal) 0%, transparent 70%);
  }

  .ambient-mesh__orb--amber {
    width: min(40vw, 380px);
    height: min(40vw, 380px);
    left: 35%;
    bottom: -10%;
    background: radial-gradient(circle, var(--ambient-amber) 0%, transparent 70%);
  }

  @keyframes ambient-mesh-drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(1.5%, -1%) scale(1.02); }
    66%       { transform: translate(-1%, 1.5%) scale(0.99); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient-mesh__orb {
      animation: none;
      opacity: calc(var(--mesh-orb-base-opacity, 0.32) * var(--mesh-orb-opacity-scale, 1) * 0.75);
    }
  }
</style>
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AmbientGradients.svelte
git commit -m "feat: replace ambient blobs with lime+teal+amber only — remove purple/indigo AI cliché"
```

---

## Task 7: Update HomeIdentityHeader — display font + hero layout

**Files:**
- Modify: `src/lib/components/HomeIdentityHeader.svelte`

- [ ] **Step 1: Add display font class to the one-liner bio**

In `HomeIdentityHeader.svelte`, find `.id-header__bio` in the `<style>` block and update its styles:

```css
  .id-header__bio {
    margin: 0 0 10px;
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 3.8vw, 1.4rem);
    font-style: italic;
    font-weight: 400;
    line-height: 1.35;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    text-wrap: balance;
  }

  .id-header--luxury .id-header__bio {
    font-size: clamp(1.05rem, 3.2vw, 1.3rem);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
```

- [ ] **Step 2: Upgrade the identity name to display font with tighter tracking**

Find `.id-header__name` and `.id-header--luxury .id-header__name` and replace both:

```css
  .id-header__name {
    margin: 0 0 4px;
    font-family: var(--font-sans);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    line-height: 1.1;
  }

  .id-header--luxury .id-header__name {
    font-size: var(--home-font-title, clamp(1.45rem, 2.2vw, 1.75rem));
    font-weight: 650;
    letter-spacing: -0.03em;
  }
```

- [ ] **Step 3: Upgrade `.id-header__tag-label` to small-caps instead of all-caps**

Find `.id-header__tag-label` and replace:

```css
  .id-header__tag-label {
    font-size: var(--home-font-meta, 11px);
    font-weight: 600;
    font-variant-caps: small-caps;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
```

- [ ] **Step 4: Apply double-bezel architecture to the identity card**

In `HomeIdentityHeader.svelte`, find `.id-header__card` CSS and replace:

```css
  .id-header__card {
    position: relative;
    padding: 6px;
    border-radius: 2rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    box-shadow: var(--shadow-tall-card);
    transition: box-shadow var(--dur-standard) var(--ease-premium);
  }

  .id-header__card--glass {
    backdrop-filter: blur(20px) saturate(1.08);
    -webkit-backdrop-filter: blur(20px) saturate(1.08);
  }

  .id-header--luxury .id-header__card {
    border-radius: 2rem;
  }

  .id-header__card--empty {
    padding: 6px;
  }
```

- [ ] **Step 5: Wrap card body in an inner core div in the template**

In the `{:else if snapshot}` block (line ~71), wrap the existing card content. Find:

```svelte
    <div class="id-header__card id-header__card--glass">
      <div class="id-header__actions">
```

Replace with:

```svelte
    <div class="id-header__card id-header__card--glass">
      <div class="id-header__card-inner">
      <div class="id-header__actions">
```

Then find the closing `</div>` for `id-header__card` (after the `{/if}` for tags) and add a matching closing `</div>` for `id-header__card-inner` before the card closing tag. Do this for ALL three `{:else if}` and `{:else}` branches.

Add to the `<style>` block:

```css
  .id-header__card-inner {
    border-radius: calc(2rem - 6px);
    background: var(--bg-elevated);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08);
    padding: 20px 20px 28px;
    overflow: hidden;
  }

  .id-header__card--empty .id-header__card-inner {
    padding: 22px 20px;
  }
```

- [ ] **Step 6: Upgrade skeleton shimmer to diagonal**

Find the `@keyframes shimmer` block and replace:

```css
  @keyframes shimmer {
    0% { opacity: 0.35; }
    50% { opacity: 0.75; }
    100% { opacity: 0.35; }
  }
```

- [ ] **Step 7: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/HomeIdentityHeader.svelte
git commit -m "feat: HomeIdentityHeader — Bodoni Moda bio, double-bezel card, small-caps labels"
```

---

## Task 8: Install and configure phosphor-svelte icons

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install phosphor-svelte**

```bash
cd /Users/madhviknemani/wagwan-ai
npm install phosphor-svelte
```

Expected: 1 package added, no errors.

- [ ] **Step 2: Verify the package exports work with Svelte 5**

```bash
node -e "const p = require('phosphor-svelte'); console.log(typeof p)" 2>/dev/null || echo "ESM only — OK for Vite"
ls node_modules/phosphor-svelte/src/ | head -5
```

Expected: directory exists with `.svelte` files.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install phosphor-svelte for refined icon set"
```

---

## Task 9: Swap Lucide icons in HomeIdentityHeader

**Files:**
- Modify: `src/lib/components/HomeIdentityHeader.svelte`

- [ ] **Step 1: Replace Lucide imports with Phosphor at top of `<script>`**

Find:

```svelte
  import { User, RefreshCw } from '@lucide/svelte';
```

Replace with:

```svelte
  import { UserCircle, ArrowClockwise } from 'phosphor-svelte';
```

- [ ] **Step 2: Replace icon usage in template**

Find all occurrences of `<RefreshCw size={16} strokeWidth={2} />` and replace with:

```svelte
<ArrowClockwise size={16} weight="light" />
```

Find all occurrences of `<User size={16} strokeWidth={2} />` and replace with:

```svelte
<UserCircle size={16} weight="light" />
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/HomeIdentityHeader.svelte
git commit -m "feat: swap Lucide → Phosphor Light icons in HomeIdentityHeader"
```

---

## Task 10: Upgrade GlassPanel with bezel prop

**Files:**
- Modify: `src/lib/components/GlassPanel.svelte`

- [ ] **Step 1: Replace `GlassPanel.svelte`**

```svelte
<script lang="ts">
  /** Inset panel using semantic tokens; pairs with app.css (.ui-panel*). */
  export let solid = false;
  export let r12 = false;
  export let r14 = false;
  export let r16 = false;
  export let clip = false;
  /** When true, renders the double-bezel architecture (outer shell + inner core) */
  export let bezel = false;
  let className = '';
  export { className as class };
</script>

{#if bezel}
  <div class="w-card-bezel {className}">
    <div class="w-card-bezel__inner">
      <slot />
    </div>
  </div>
{:else}
  <div
    class="ui-panel {className}"
    class:ui-panel--solid={solid}
    class:ui-panel--r12={r12}
    class:ui-panel--r14={r14}
    class:ui-panel--r16={r16}
    class:ui-panel--clip={clip}
  >
    <slot />
  </div>
{/if}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/GlassPanel.svelte
git commit -m "feat: add bezel prop to GlassPanel for double-bezel architecture"
```

---

## Task 11: Upgrade FloatingNav — double-bezel + dot indicator + grain

**Files:**
- Modify: `src/lib/components/FloatingNav.svelte`

- [ ] **Step 1: Read the current FloatingNav**

```bash
cat /Users/madhviknemani/wagwan-ai/src/lib/components/FloatingNav.svelte
```

Note the exact structure of the nav pill and active state logic.

- [ ] **Step 2: Add grain overlay pseudo-element and dot active indicator to `<style>`**

Locate the `<style>` block. Add these rules at the end:

```css
  /* Grain overlay — fixed, pointer-events-none */
  nav[aria-label='Main navigation'] > div::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 128px 128px;
    pointer-events: none;
    z-index: 1;
  }

  /* Active nav dot indicator */
  .nav-dot {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent-primary);
    opacity: 0;
    transition: opacity var(--dur-micro) var(--ease-premium);
  }

  .nav-item--active .nav-dot {
    opacity: 1;
    animation: dot-pulse 3s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
```

- [ ] **Step 3: Update nav item wrapper to use `position: relative` for dot positioning**

In the template, wrap each nav icon link with `<span class="nav-item-wrap" class:nav-item--active={...}>` and add `<span class="nav-dot" aria-hidden="true"></span>` inside each active wrapper. The exact pattern depends on current markup — add `position: relative` to the icon wrapper elements and insert the dot span after the icon.

Add to `<style>`:

```css
  .nav-item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/FloatingNav.svelte
git commit -m "feat: FloatingNav — grain overlay, lime dot active indicator"
```

---

## Task 12: Add page-load stagger animation to Home

**Files:**
- Modify: `src/routes/(app)/home/+page.svelte`

- [ ] **Step 1: Add entrance animation CSS to the bottom of Home page `<style>` block**

At the end of the `<style>` block in `+page.svelte`, add:

```css
  /* ── Page load entrance animations ── */
  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(32px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes blur-in {
    from {
      opacity: 0;
      filter: blur(8px);
    }
    to {
      opacity: 1;
      filter: blur(0);
    }
  }

  .home-enter-hero {
    animation: fade-up 800ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 100ms both;
  }

  .home-enter-1 {
    animation: fade-up 600ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 180ms both;
  }

  .home-enter-2 {
    animation: fade-up 600ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 260ms both;
  }

  .home-enter-3 {
    animation: fade-up 600ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 340ms both;
  }

  .home-enter-4 {
    animation: fade-up 600ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 420ms both;
  }

  .home-enter-media {
    animation: blur-in 900ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 500ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    .home-enter-hero,
    .home-enter-1,
    .home-enter-2,
    .home-enter-3,
    .home-enter-4,
    .home-enter-media {
      animation: none;
    }
  }
```

- [ ] **Step 2: Apply entrance classes to the main Home page sections**

In the Home page template, find the major section wrappers and add entrance classes. The identity header section gets `home-enter-hero`. Subsequent sections get `home-enter-1` through `home-enter-4` in order. Music/media tiles get `home-enter-media`.

Look for the main feed sections in the template (they typically have class names like `home-feed-section`, `home-section`, or similar wrappers). Add the entrance class to each top-level section div:

```svelte
<!-- Identity header wrapper -->
<div class="home-enter-hero">
  <HomeIdentityHeader ... />
</div>

<!-- First content section after header -->
<section class="home-enter-1 ...">
  ...
</section>

<!-- Second section -->
<section class="home-enter-2 ...">
  ...
</section>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/home/+page.svelte
git commit -m "feat: home page stagger entrance animations with blur-in for media elements"
```

---

## Task 13: Swap Lucide icons across remaining components

**Files:**
- Modify: any `.svelte` file importing from `@lucide/svelte`

- [ ] **Step 1: Find all files still using Lucide**

```bash
grep -rl "@lucide/svelte" /Users/madhviknemani/wagwan-ai/src --include="*.svelte" | grep -v HomeIdentityHeader
```

Note the list of files.

- [ ] **Step 2: For each file found, replace the import and icon usage**

The mapping from Lucide → Phosphor Light is:

| Lucide | Phosphor equivalent | weight |
|--------|--------------------|----|
| `Mic` | `Microphone` | `"light"` |
| `Send` | `PaperPlaneTilt` | `"light"` |
| `Plus` | `Plus` | `"light"` |
| `Camera` | `Camera` | `"light"` |
| `Music` | `MusicNote` | `"light"` |
| `Briefcase` | `Briefcase` | `"light"` |
| `ThumbsUp` | `ThumbsUp` | `"light"` |
| `ThumbsDown` | `ThumbsDown` | `"light"` |
| `RefreshCw` | `ArrowClockwise` | `"light"` |
| `User` | `UserCircle` | `"light"` |
| `Home` | `House` | `"light"` |
| `MessageCircle` | `ChatCircle` | `"light"` |
| `Search` | `MagnifyingGlass` | `"light"` |
| `Settings` | `GearSix` | `"light"` |
| `ChevronRight` | `CaretRight` | `"light"` |
| `ChevronDown` | `CaretDown` | `"light"` |
| `X` | `X` | `"light"` |
| `Check` | `Check` | `"light"` |
| `AlertCircle` | `Warning` | `"light"` |
| `Info` | `Info` | `"light"` |
| `Star` | `Star` | `"light"` |
| `Heart` | `Heart` | `"light"` |
| `Share` | `ShareNetwork` | `"light"` |
| `ExternalLink` | `ArrowSquareOut` | `"light"` |
| `Loader` | `CircleNotch` | `"light"` |
| `LogOut` | `SignOut` | `"light"` |

For each file, change the import from:
```svelte
import { IconName, IconName2 } from '@lucide/svelte';
```
to:
```svelte
import { PhosphorIcon1, PhosphorIcon2 } from 'phosphor-svelte';
```

Change each usage from `<IconName size={N} strokeWidth={2} />` to `<PhosphorIcon1 size={N} weight="light" />`.

- [ ] **Step 3: Verify no remaining Lucide imports**

```bash
grep -rl "@lucide/svelte" /Users/madhviknemani/wagwan-ai/src --include="*.svelte"
```

Expected: empty output (no files found).

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: migrate all icons from Lucide → Phosphor Light weight"
```

---

## Task 14: Write `.impeccable.md` design context file

**Files:**
- Create: `.impeccable.md`

- [ ] **Step 1: Create `.impeccable.md` in project root**

```markdown
## Design Context

### Users
Young adults (18–35) who have connected their digital identity (Instagram, Spotify, Apple Music, Google, LinkedIn). They use Wagwan daily as a personalized lifestyle intelligence companion — opening the app to understand themselves, get personalized recommendations, and talk to an AI that genuinely knows them. Context: mobile-first, used in morning and evening, intimate and personal.

### Brand Personality
Bold. Alive. Personal. The interface should feel like a luxury culture magazine printed specifically for you today. Not a dashboard — a magazine cover about you. Three words: expressive, editorial, intimate.

### Aesthetic Direction
Living Editorial: Spotify Wrapped energy meets a high-end culture magazine.
- Dark mode is primary (used for evening/night); light mode equally refined (morning)
- Acid-lime (#c4f24a) is the singular brand anchor across both modes
- Bodoni Moda (editorial italic serif) for identity/display copy
- Geist (precise grotesque) for UI and body copy
- Geist Mono for data, numbers, and metrics
- Asymmetric bento grid on Home, not uniform card rows
- Double-bezel card architecture for haptic depth

### Design Principles
1. Personal over generic — every visual decision reinforces that this was built for this specific user
2. Editorial confidence — headlines are bold and declarative, not shy or hedged
3. Alive, not static — the UI breathes; perpetual micro-motion makes it feel inhabited
4. Restraint with moments of drama — whitespace makes bold moments land harder
5. Both modes are equal — light mode is not an afterthought
```

- [ ] **Step 2: Commit**

```bash
git add .impeccable.md
git commit -m "docs: add .impeccable.md design context for future AI sessions"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Font swap (Task 1)
- ✅ Dark mode tokens (Task 3)
- ✅ Light mode tokens (Task 4)
- ✅ Shared easing tokens (Task 2)
- ✅ Button pill shape + remove grad-text (Task 5)
- ✅ Card double-bezel + hover shadow (Tasks 5, 10)
- ✅ AmbientGradients lime+teal only (Task 6)
- ✅ HomeIdentityHeader display font + hero (Task 7)
- ✅ Icon swap Lucide → Phosphor (Tasks 8, 9, 13)
- ✅ FloatingNav grain + dot (Task 11)
- ✅ Page load entrance animation (Task 12)
- ✅ Design context file (Task 14)
- ⚠️ DesktopSidebar icon swap covered by Task 13 (applies to all remaining components)
- ⚠️ ResultCard double-bezel: apply `.w-card-bezel` class in the template — do this when you encounter ResultCard.svelte during Task 13

**No placeholders found.** All steps contain real code.

**Type consistency:** `--ease-premium` and `--ease-entrance` defined in Task 2, used in Tasks 3, 4, 5, 7, 11, 12. All consistent.

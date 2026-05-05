# Dashboard Visual Theme Alignment

**Date:** 2026-05-06
**Status:** Approved
**Workstream:** 1 of 4 (Theme → Layout → Creator Intelligence → Brand Matching)
**Files:** `src/routes/(app)/home/+page.svelte`, `src/routes/(app)/+layout.svelte`

## Problem

The dashboard uses a different visual palette (orange, teal, pink, gold accents on flat dark surfaces) than the landing page (lime/magenta accents, gradient backgrounds, glassmorphism cards). This creates a jarring transition when users enter the app.

## Design

### Background

Replace the current flat dark app shell background with the landing page's layered gradient:

```css
background:
  radial-gradient(circle at 72% 18%, rgba(153, 36, 96, 0.34), transparent 42%),
  radial-gradient(circle at 30% 78%, rgba(196, 242, 74, 0.12), transparent 32%),
  linear-gradient(145deg, #030306 0%, #0b0710 48%, #1b0817 100%);
```

No animated orbs on the dashboard — keep it calmer than the landing page. The gradient provides depth without distraction.

Applied in the `(app)/+layout.svelte` app shell so all app pages inherit it.

### Accent Color Replacement

All existing accent colors become lime/magenta:

| Old color          | Old use               | New color                 |
| ------------------ | --------------------- | ------------------------- |
| `#E8833A` (orange) | Graph metric ring     | `#c4f24a` (lime)          |
| `#7FC8A9` (teal)   | Briefs metric ring    | `rgba(196, 242, 74, 0.7)` |
| `#E87FA8` (pink)   | Brands metric ring    | `rgba(196, 242, 74, 0.5)` |
| `#D9C26E` (gold)   | Deals metric ring     | `rgba(196, 242, 74, 0.3)` |
| `#4D7CFF` (blue)   | Various links/accents | `#c4f24a`                 |
| `#FF4D4D` (red)    | Alerts/errors         | `#ff4d97` (magenta)       |

Primary accent: `#c4f24a` (lime)
Secondary accent: `#ff4d97` (magenta) — used for brand requests, alerts, urgent states
Label/kicker green: `#9cec7b` — used for section labels and card kickers

### Card Surface Treatment (3 tiers)

**Tier 1 — Hero cards** (earnings, top header area):

```css
border-radius: 28px;
border: 1px solid rgba(255, 255, 255, 0.14);
background:
  linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.045)),
  rgba(20, 18, 23, 0.72);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.08),
  0 28px 80px rgba(0, 0, 0, 0.34);
backdrop-filter: blur(28px);
```

**Tier 2 — Action cards** (brand requests, brand ecosystem):

```css
border-radius: 24px;
border: 1px solid rgba(255, 255, 255, 0.1);
background:
  linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
  rgba(20, 18, 23, 0.65);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.06),
  0 16px 48px rgba(0, 0, 0, 0.28);
backdrop-filter: blur(20px);
```

**Tier 3 — Utility cards** (metrics, watch tonight, read next, creator DNA, activity):

```css
border-radius: 20px;
border: 1px solid rgba(255, 255, 255, 0.08);
background: rgba(255, 255, 255, 0.04);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
backdrop-filter: blur(12px);
```

All cards: `border-color: rgba(196, 242, 74, 0.2)` on hover with 200ms transition.

### Ring Meters

The 4 ring meters in Creator Metrics card currently use `--ring-color` with different per-metric colors. Replace with lime at varying opacity:

- Graph: `#c4f24a` (100%)
- Briefs: `rgba(196, 242, 74, 0.7)`
- Brands: `rgba(196, 242, 74, 0.5)`
- Deals: `rgba(196, 242, 74, 0.3)`

Ring track (background) changes from current to `rgba(255, 255, 255, 0.08)`.

### Text Colors

- High contrast text: `oklch(96% 0.018 88)` (warm off-white, same as landing page)
- Body/secondary text: `rgba(255, 248, 232, 0.65)`
- Muted text: `rgba(255, 248, 232, 0.45)`
- Section labels/kickers: `#9cec7b` (landing page green)
- Links and interactive text: `#c4f24a`

### Borders and Dividers

- Card borders: `rgba(255, 255, 255, 0.08)` default, `rgba(196, 242, 74, 0.2)` on hover
- Section dividers: `rgba(255, 255, 255, 0.06)`
- Input borders: `rgba(255, 255, 255, 0.12)`

### Buttons

- Primary action buttons: `background: #c4f24a; color: #0a0a0a` (same as landing page)
- Secondary/ghost buttons: `border: 1px solid rgba(255,255,255,0.14); color: rgba(255,248,232,0.6)` (same as landing page switch button)
- Danger/decline buttons: `background: rgba(255, 77, 151, 0.15); color: #ff4d97`

### Sidebar Nav

The sidebar (`DesktopSidebar.svelte`) and mobile nav (`FloatingNav.svelte`) get:

- Active state background: `rgba(196, 242, 74, 0.12)` with `color: #c4f24a`
- Inactive: `rgba(255, 248, 232, 0.5)`
- Hover: `rgba(255, 255, 255, 0.06)` background

### Chat Aside

- Chat bubbles (AI): Tier 3 glass treatment
- Chat bubbles (user): `background: rgba(196, 242, 74, 0.1); border: 1px solid rgba(196, 242, 74, 0.15)`
- Composer input: `background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1)`
- Send button: lime `#c4f24a`

## What stays the same

- All data sources, API calls, business logic
- Section order and HTML structure
- Font families (already Bodoni Moda / Geist / Geist Mono)
- Mobile nav behavior and layout modes
- Chat functionality

## Scope

CSS-only changes. No HTML structure changes. No new components. No backend changes. The scoped styles in `home/+page.svelte` are the primary target (~500+ lines of style to update). The `(app)/+layout.svelte` gets the gradient background. Sidebar and mobile nav components get accent color updates.

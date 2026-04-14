# Wagwan Design System

The single source of truth for all visual decisions across the product. Every page — user app, brand portal, onboarding, landing — follows this system.

---

## Color Palette

### Dark Mode (Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `oklch(8% 0.008 260)` | Page backgrounds |
| `--bg-secondary` | `oklch(10% 0.009 255)` | Elevated surfaces, cards |
| `--bg-elevated` | `oklch(13% 0.010 258)` | Inputs, modals, dropdowns |
| `--text-primary` | `#e8ecf3` | Headlines, body text |
| `--text-secondary` | `#9aa3b2` | Descriptions, labels |
| `--text-muted` | `#6d7684` | Hints, metadata, placeholders |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `#FF4D4D` | Primary actions, key highlights |
| `--accent-secondary` | `#4D7CFF` | Secondary actions, links, data |
| `--accent-tertiary` | `#FFB84D` | Tertiary highlights, gold accents |

**Gradients:**
- CTA buttons: `linear-gradient(135deg, #FF4D4D, #FFB84D)` (red to gold)
- Accent wash: `linear-gradient(120deg, rgba(255,77,77,0.12), rgba(77,124,255,0.10), rgba(255,184,77,0.08))`

### Borders & Glass

| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | `rgba(255,255,255,0.08)` | Default borders |
| `--border-strong` | `rgba(255,255,255,0.14)` | Hover borders, emphasis |
| `--glass-light` | `rgba(255,255,255,0.055)` | Glass card backgrounds |
| `--glass-medium` | `rgba(255,255,255,0.08)` | Elevated glass surfaces |

### States

| Token | Value | Usage |
|-------|-------|-------|
| `--state-success` | `#22c55e` | Success indicators |
| `--state-warning` | `#ca8a04` | Warning indicators |
| `--state-error` | `#ef4444` | Error states |

---

## Typography

| Font | Usage | Token |
|------|-------|-------|
| Geist | All UI text, body, labels | `--font-sans` |
| Geist Mono | Numbers, data, code | `--font-mono` |
| Bodoni Moda | Hero one-liner on home page ONLY | `--font-display` |

**Bodoni Moda is used in exactly ONE place**: the hero identity one-liner on the home page. Nowhere else. Not section headers, not card titles, not the brand portal.

### Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | `clamp(44px, 12vw, 64px)` | 800 | Home hero one-liner only |
| H1 | `clamp(28px, 6vw, 40px)` | 700 | Page titles |
| H2 | `18-20px` | 700 | Section titles |
| H3 | `15px` | 700 | Card titles |
| Body | `14px` | 400 | Body text |
| Small | `12-13px` | 400-500 | Labels, metadata |
| Tiny | `10-11px` | 600-700 | Uppercase labels, badges |

---

## Spacing

Use multiples of 4px. The system scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.

Never use off-system values (7px, 13px, 14px gaps, etc.)

---

## Components

### Buttons

**Primary (CTA):**
```css
background: linear-gradient(135deg, #FF4D4D, #FFB84D);
color: white;
border-radius: 100px;
padding: 12px 24px;
font-weight: 700;
```

**Secondary (Ghost):**
```css
background: transparent;
border: 1px solid var(--border-subtle);
color: var(--text-secondary);
border-radius: 100px;
```

**Active state:** `transform: scale(0.97)` on press.

### Cards / Surfaces

```css
background: var(--glass-light);
border: 1px solid var(--border-subtle);
border-radius: 16px;
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
```

### Inputs

```css
background: var(--bg-elevated);
border: 1px solid var(--border-subtle);
border-radius: 12px;
padding: 12px 16px;
color: var(--text-primary);
font-size: 14px;
```
Focus: `border-color: var(--accent-secondary)` (blue).

---

## Banned Patterns

- No violet, purple, or fuchsia anywhere
- No Bodoni Moda except home hero one-liner
- No hardcoded colors — always use CSS vars
- No off-system spacing values
- No emojis in the brand portal (use text labels or SVG icons)
- No ambient mesh gradients on the brand portal (brands want clarity)
- No glassmorphism overuse — one level of glass, not nested glass on glass

---

## Page-Specific Rules

### User App (Home, Profile, Chat, Explore, Earn)
- Dark mode with ambient mesh background
- Glass panels, narrative sections
- Emojis allowed as section labels
- Bodoni Moda for hero one-liner only
- SVG charts and visual data displays

### Brand Portal (Landing, Login, Portal)
- Dark mode, NO ambient mesh — clean solid background
- Minimal, tool-like aesthetic
- The chat agent IS the primary interface
- No emojis — use text and icons
- Data presented cleanly, not in cards — use spacing and borders

### Onboarding
- Dark mode with ambient mesh (matches user app)
- Glass panels for inputs
- Emojis in section headers
- Product preview cards

---

## File Locations

| What | Where |
|------|-------|
| Dark mode tokens | `src/styles/tokens-home-dark.css` |
| Light mode tokens | `src/styles/tokens-light.css` |
| Shared tokens | `src/styles/tokens-shared.css` |
| Typography | `src/styles/typography.css` |
| Component utils | `src/styles/components.css` |
| Identity colors | `src/lib/theme/identityColors.ts` |

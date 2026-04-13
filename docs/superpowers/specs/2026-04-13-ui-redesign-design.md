# Wagwan UI Redesign — Design Spec
**Date:** 2026-04-13  
**Approach:** Living Editorial  
**Stack:** SvelteKit 5 + Tailwind CSS v3 + CSS custom properties (no framework migration)

---

## Design Context

### Users
People who have connected their digital identity (Instagram, Spotify, Apple Music, Google, LinkedIn) and use Wagwan daily as a personalized lifestyle intelligence companion. They open the app to understand themselves, get personalized recommendations, and converse with an AI that genuinely knows them. Context: mobile-first, used in the morning and evening, personal and intimate.

### Brand Personality
**Bold. Alive. Personal.** The app should feel like a luxury culture magazine that was printed specifically for you today. Not a dashboard — a magazine cover about you.

### Aesthetic Direction
- Living Editorial: Spotify Wrapped energy meets a high-end culture magazine
- Dark mode is primary, light mode equally refined
- Acid-lime (`#c4f24a`) as the singular brand anchor across both modes
- Editorial serif for identity/display copy; precise grotesque for UI; monospace for data
- Asymmetric bento grid on Home, not uniform card rows

### Design Principles
1. **Personal over generic** — every visual decision should reinforce that this was built for this specific user
2. **Editorial confidence** — headlines are bold and declarative, not shy or hedged
3. **Alive, not static** — the UI breathes; perpetual micro-motion makes it feel inhabited
4. **Restraint with moments of drama** — whitespace and discipline make the bold moments land harder
5. **Both modes are equal** — light mode is not an afterthought; it has its own distinct character

---

## Typography

### Font Stack
| Role | Font | Usage |
|------|------|-------|
| Display / Identity | `Editorial New` (or `Canela` fallback) | Identity headlines, AI synthesis statements, major section titles |
| UI / Body | `Geist` | Navigation, labels, body copy, button text |
| Data / Numbers | `Geist Mono` | Stats, scores, percentages, timestamps, metric values |

### Type Scale
- **Display (identity headline):** `clamp(2rem, 5vw, 3.5rem)`, `tracking-tighter`, `leading-none`, weight 400 (serif italic preferred)
- **Section title:** `1.125rem`, `tracking-tight`, weight 600, Geist
- **Body:** `0.875rem`, `leading-relaxed`, max-width `65ch`, Geist
- **Label / kicker:** `0.6875rem`, `tracking-[0.12em]`, uppercase, weight 500, Geist
- **Data:** `Geist Mono`, tabular-nums, varied sizes per context

### Rules
- No gradient text anywhere (`.grad-text` class removed)
- All-caps only for short labels (≤ 3 words), never body text
- `text-wrap: balance` on all display headlines to prevent orphans
- Negative tracking on all display sizes, positive tracking on labels

---

## Color System

### Dark Mode Tokens (replacing `tokens-home-dark.css`)
```css
/* Backgrounds — blue-tinted blacks, perceptually consistent */
--bg-primary: oklch(8% 0.008 260);        /* was #080a0e */
--bg-secondary: oklch(10% 0.009 255);     /* was #0e1118 */
--bg-elevated: oklch(13% 0.010 258);      /* was #141820 */

/* Brand accent — lime, unchanged */
--accent-primary: #c4f24a;                /* kept */
--accent-glow: oklch(75% 0.22 130 / 0.32);
--accent-soft: oklch(75% 0.22 130 / 0.12);

/* Ambient orbs — lime + teal only (remove purple/indigo) */
--blob-tint-a: oklch(75% 0.22 130 / 0.18);   /* lime */
--blob-tint-b: oklch(55% 0.14 200 / 0.15);   /* deep teal */
--blob-tint-c: oklch(65% 0.10 210 / 0.12);   /* teal-blue */
/* REMOVED: rgba(99,102,241) indigo blobs — AI cliché */

/* Shadows — tinted, not pure black */
--shadow-card: 0 8px 24px oklch(75% 0.22 130 / 0.15);
--shadow-tall-card: 0 12px 40px oklch(8% 0.008 260 / 0.6);
```

### Light Mode Tokens (replacing `tokens-light.css`)
```css
/* Backgrounds — warm newsprint */
--bg-primary: oklch(96% 0.012 80);        /* warm cream, was #f4f2ef */
--bg-secondary: oklch(93% 0.013 78);      /* was #ebe8e3 */
--bg-elevated: oklch(99% 0.005 80);       /* near-white with warmth */

/* Accent — same lime, used sparingly (highlighter on paper effect) */
--accent-primary: #c4f24a;               /* consistent brand across modes */
--accent-glow: oklch(75% 0.22 130 / 0.28);
--accent-soft: oklch(75% 0.22 130 / 0.10);

/* Text — warm, not cold gray */
--text-primary: oklch(12% 0.010 260);    /* warm near-black */
--text-secondary: oklch(42% 0.012 250);  /* warm mid-gray */

/* Ambient orbs — warm amber + lime (no purple/blue) */
--blob-tint-a: oklch(75% 0.22 130 / 0.14);   /* lime */
--blob-tint-b: oklch(72% 0.16 80 / 0.12);    /* warm amber */
/* REMOVED: rgba(99,102,241) and rgba(96,165,250) AI gradient blobs */

/* Glass — warm-tinted, not cool white */
--glass-light: oklch(99% 0.008 80 / 0.72);
--glass-medium: oklch(99% 0.008 80 / 0.90);
```

### Color Rules
- Max 1 accent color: lime (`#c4f24a`) — consistent across both modes
- All neutrals tinted toward lime-green/teal hue family — no mixing warm/cool
- No purple, no indigo, no blue gradients
- Shadows always carry the hue of the surface they cast from

---

## Layout

### Home Page — Asymmetric Editorial Bento

**Hero Slot (full width):**
- Left 60%: Identity headline in display serif (bold AI-generated statement about the user), vibe tags below as pill badges
- Right 40%: Profile photo, slightly overlapping into the section below to create z-axis depth
- Background: ambient gradient mesh using only lime + teal blobs
- No card container — text sits directly on the background

**Bento Grid (CSS Grid, 12 columns):**
```
[ Music Context — col 1-7, row 1 ] [ Identity Intelligence — col 8-12, row 1 ]
[ Identity Intelligence cont.     ] [ col 8-12, row 2 (stacked panels)        ]
[ Recommendations — full width horizontal scroll, row 3 ]
[ Current Read / Synthesis — col 1-8, row 4 ] [ Quick Ask — col 9-12, row 4 ]
[ Calendar / Gmail insights — col 1-4, row 5 ] [ More recs — col 5-12, row 5 ]
```

**Mobile collapse (< 768px):** Single column, all col-span overrides reset to `col-span-1`, identity headline stays large, music tile full-width at 240px height.

**Card Architecture — Double-Bezel pattern:**
All major cards use nested architecture:
```html
<!-- Outer shell -->
<div class="p-1.5 rounded-[2rem] ring-1 ring-white/10 bg-white/5">
  <!-- Inner core -->
  <div class="rounded-[calc(2rem-0.375rem)] bg-elevated shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
    content
  </div>
</div>
```

### Chat Page
- Twin blob demoted to ambient corner element (top-right, 80px, slow-breathing)
- Chat takes full vertical focus
- User bubbles: right-aligned, lime outer shell border via double-bezel
- AI bubbles: left-aligned, slightly wider, display serif for bold statements
- Composer: double-bezel pill at bottom, voice button breathes when idle

### Desktop Sidebar
- 64px collapsed icon rail, expands to 200px on hover
- "Wagwan" logotype in display font, tight tracking
- Icons: Phosphor Light (replace all Lucide icons)
- Active state: lime dot beneath icon, no background fill

### Mobile Floating Nav
- Pill with double-bezel technique
- Subtle grain texture overlay (fixed, pointer-events-none pseudo-element)
- Active: lime dot indicator, no fill
- No backdrop-blur on scrolling content — only on the fixed pill itself

---

## Motion System

### Easing
All transitions use: `cubic-bezier(0.32, 0.72, 0, 1)` — heavy deceleration, no linear, no ease-in-out, no bounce/elastic.

Duration scale:
- Micro (hover states): 150ms
- Standard (state changes): 250ms  
- Entrance (page load): 600–800ms
- Ambient (perpetual loops): 8–14s

### Page Load Sequence (Home)
1. Background mesh gradient fades in: 0ms, 400ms duration
2. Identity headline translates up from `translateY(40px) opacity(0)` → `translateY(0) opacity(1)`: 100ms delay, 800ms duration
3. Bento tiles stagger in: 80ms cascade delay per tile, 600ms each
4. Music art cross-fades last with blur-to-sharp: `blur(8px) opacity(0)` → `blur(0) opacity(1)`, 900ms

### Perpetual Micro-Life
- Album art: `scale(1.0) → scale(1.03)` float loop, 12s infinite, `ease-in-out`
- Active nav lime dot: pulse opacity `0.6 → 1.0`, 3s infinite
- Skeleton loaders: diagonal shimmer (not horizontal sweep)
- Twin blob (chat): `scale(0.97) → scale(1.03)`, 4s infinite breathing

### Hover States
All interactive cards:
```css
transform: translateY(-4px);
box-shadow: 0 8px 24px oklch(75% 0.22 130 / 0.25); /* lime-tinted shadow */
transition: cubic-bezier(0.32, 0.72, 0, 1) 250ms;
```

Button active press: `scale(0.98) translateY(1px)` — simulates physical click.

### Performance Rules
- Animate only `transform` and `opacity` — never `width`, `height`, `top`, `left`
- `backdrop-blur` only on fixed/sticky elements (nav pill, modals)
- Grain overlays: `position: fixed; pointer-events: none` pseudo-element only
- `will-change: transform` used sparingly, only on actively-animating elements
- Infinite loops isolated in their own Svelte components to prevent parent re-renders

---

## Component Upgrades

### Icons
- Replace all Lucide imports with `phosphor-svelte` (Phosphor Light weight)
- Standardize stroke to `weight="light"` globally
- Remove rocket/shield clichés — use bolt, fingerprint, spark equivalents

### Buttons
- `.btn-primary`: becomes a pill (`rounded-full`), gradient removed, solid lime fill, nested arrow icon in circular wrapper
- `.btn-secondary`: glass pill, lime border glow on hover
- Remove `.grad-text` class entirely

### Cards
- All `.w-card` and `.ui-panel` instances upgraded to double-bezel where elevation matters
- Where elevation doesn't matter: remove card entirely, use spacing + dividers only

### Navigation Labels / Badges
- `.section-label`: small-caps instead of all-caps screaming, Geist 500 weight
- `.match-badge`: squircle shape instead of full pill
- `.ui-badge-pill`: replace pill shape with square badge with tight radius

---

## What Is NOT Changing

- SvelteKit 5 framework and file structure
- Supabase, Redis, all backend integrations
- Routing structure (`/(app)/home`, `/ai`, `/explore`, `/profile`, `/chats`)
- Store architecture (`profile`, `chatMemory`, `twinMemory`, etc.)
- Core component logic — only markup/styling updated
- Tailwind config extensions (colors added, nothing removed)

---

## Files Touched

| File | Change |
|------|--------|
| `src/styles/tokens-home-dark.css` | Full token replacement per spec |
| `src/styles/tokens-light.css` | Full token replacement per spec |
| `src/styles/tokens-shared.css` | Easing variables, spacing scale additions |
| `src/styles/components.css` | Button, card, badge component upgrades |
| `src/styles/typography.css` | Font stack swap, scale adjustments |
| `src/app.css` | Font imports (Editorial New, Geist, Geist Mono) |
| `tailwind.config.js` | Font family extensions |
| `src/routes/(app)/home/+page.svelte` | Bento grid layout, hero slot |
| `src/routes/(app)/+layout.svelte` | Sidebar icon swap, collapse behavior |
| `src/lib/components/GlassPanel.svelte` | Double-bezel architecture |
| `src/lib/components/ResultCard.svelte` | Double-bezel, hover states |
| `src/lib/components/HomeIdentityHeader.svelte` | Display font, hero layout |
| `src/lib/components/FloatingNav.svelte` | Double-bezel, grain overlay, dot indicator |
| `src/lib/components/DesktopSidebar.svelte` | Icon swap, collapse behavior |
| `src/lib/components/AmbientGradients.svelte` | Blob colors (remove purple/indigo) |
| `src/lib/components/TwinHeroBlob.svelte` | Demote to ambient corner element |
| `src/routes/(app)/ai/+page.svelte` | Chat bubble architecture, composer pill |

---

## Implementation Order (Priority)

1. Font swap + token replacement (biggest visual impact, lowest risk)
2. Remove purple/indigo blobs from AmbientGradients
3. Button and card component upgrades (double-bezel, pill CTAs)
4. Home hero slot + bento grid layout
5. Motion system (easing variables, page load sequence, perpetual micro-life)
6. Icon swap (Lucide → Phosphor Light)
7. Chat screen upgrades
8. Navigation upgrades (sidebar collapse, mobile nav double-bezel)

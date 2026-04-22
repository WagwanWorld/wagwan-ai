# Brand Dashboard Glass Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editorial/magazine brand dashboard with a dark glass bento-grid design — 3D frosted glass cards, ambient gradient orbs, dot-grid texture, staggered entrance animations, horizontal scroll strips, brand-derived color theming, and click-to-expand detail panels on every card.

**Architecture:** Replace the editorial CSS token system (`tokens-editorial.css`, `tokens-editorial-dark.css`) with a new glass token system (`tokens-glass.css`). Rewrite the brands layout shell, the BrandStrategist orchestrator, and all 8 Strat* section components to use the glass design language. Every card expands on click to reveal detailed analysis — the expanded state shows the full data that was previously hidden. The backend APIs, data flow, business logic, component props, event dispatchers, and phased refresh pipeline are ALL preserved exactly as-is — this is a pure visual reskin, not a restructure.

**Key principle:** Keep all existing `<script>` blocks (imports, props, state, functions, reactive declarations) unchanged. Only rewrite `<template>` and `<style>` sections. If a component has `export let`, `createEventDispatcher`, `onMount`, or reactive `$:` blocks, those stay verbatim.

**Tech Stack:** SvelteKit, Tailwind CSS (existing), CSS custom properties, CSS animations (no JS animation library), existing `identityColors.ts` for brand-derived theming.

**Design Reference:** The approved mockup is at `.superpowers/brainstorm/34623-1776798237/content/brand-dashboard-v7.html` — dark glass bento grid with 3D card depth (inner highlights + layered shadows), ambient morphing orbs, dot-grid background, staggered fade-up entrance, horizontal scroll for creators/posts, and brand color-tinted card gradients.

---

## File Structure

| File | Action | Role |
|------|--------|------|
| `src/styles/tokens-glass.css` | **Create** | Glass design tokens — replaces editorial tokens for brands |
| `src/styles/tokens-editorial.css` | **Keep** | Still used by non-brand pages; no changes |
| `src/styles/tokens-editorial-dark.css` | **Keep** | Still used by non-brand pages; no changes |
| `src/app.css` | **Modify** | Add glass token import |
| `src/routes/brands/+layout.svelte` | **Rewrite** | Dark glass shell with ambient orbs, minimal top bar |
| `src/lib/components/brands/BrandStrategist.svelte` | **Rewrite** | Glass bento orchestrator — profile hero + posts strip + bento grid |
| `src/lib/components/brands/GlassCard.svelte` | **Create** | Reusable 3D glass card component |
| `src/lib/components/brands/StratWeeklyBrief.svelte` | **Rewrite** | Glass card brief |
| `src/lib/components/brands/StratProposals.svelte` | **Rewrite** | Glass card proposals |
| `src/lib/components/brands/StratBrandDirection.svelte` | **Rewrite** | Glass card brand direction |
| `src/lib/components/brands/StratEngagementBreakdown.svelte` | **Rewrite** | Glass card engagement stats |
| `src/lib/components/brands/StratAudienceDNA.svelte` | **Rewrite** | Glass card audience |
| `src/lib/components/brands/StratPostingHeatmap.svelte` | **Rewrite** | Glass card heatmap |
| `src/lib/components/brands/StratContentIdeas.svelte` | **Rewrite** | Glass card ideas |
| `src/lib/components/brands/StratCompetitorWatch.svelte` | **Rewrite** | Glass card competitors |
| `src/routes/brands/creators/+page.svelte` | **Rewrite** | Glass bento creator index |
| `src/routes/brands/portal/+page.svelte` | **Modify** | Remove editorial references, use glass shell |

---

## Task 1: Glass Design Tokens

**Files:**
- Create: `src/styles/tokens-glass.css`
- Modify: `src/app.css`

Create the glass design system tokens that replace the editorial tokens for the brands portal.

- [ ] **Step 1: Create glass tokens**

```css
/* src/styles/tokens-glass.css */
/* Glass bento dashboard design system — brands portal only */

.glass-shell {
  /* ── Base ── */
  --g-bg: #08080d;
  --g-bg-dot: rgba(255,255,255,0.012);
  --g-dot-size: 40px;

  /* ── Text hierarchy ── */
  --g-text: rgba(255,255,255,0.92);
  --g-text-2: rgba(255,255,255,0.55);
  --g-text-3: rgba(255,255,255,0.35);
  --g-text-4: rgba(255,255,255,0.2);
  --g-text-ghost: rgba(255,255,255,0.1);

  /* ── Card glass ── */
  --g-card-bg: linear-gradient(175deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.008) 100%);
  --g-card-border: rgba(255,255,255,0.04);
  --g-card-border-hover: rgba(255,255,255,0.065);
  --g-card-highlight: rgba(255,255,255,0.03);  /* top inner inset */
  --g-card-shadow-bottom: rgba(0,0,0,0.15);    /* bottom inner inset */
  --g-card-shadow-near: 0 4px 16px rgba(0,0,0,0.12);
  --g-card-shadow-far: 0 12px 40px rgba(0,0,0,0.08);
  --g-card-shadow-hover-near: 0 6px 20px rgba(0,0,0,0.15);
  --g-card-shadow-hover-far: 0 20px 50px rgba(0,0,0,0.12);
  --g-card-radius: 22px;
  --g-card-blur: 24px;

  /* ── Accent colors (overridden by brand identity) ── */
  --g-accent: #ff4040;
  --g-accent-soft: rgba(255,64,64,0.08);

  /* ── Section palette ── */
  --g-red: rgba(255,50,50,0.035);
  --g-green: rgba(52,211,153,0.03);
  --g-indigo: rgba(99,102,241,0.03);
  --g-amber: rgba(251,191,36,0.03);
  --g-rose: rgba(244,63,94,0.02);
  --g-blue: rgba(59,130,246,0.02);
  --g-teal: rgba(20,184,166,0.02);
  --g-purple: rgba(168,85,247,0.02);
  --g-emerald: rgba(16,185,129,0.02);
  --g-gold: rgba(245,158,11,0.02);

  /* ── Number colors (for stat cards) ── */
  --g-num-red: rgba(255,125,125,0.85);
  --g-num-green: rgba(110,231,183,0.85);
  --g-num-indigo: rgba(165,180,252,0.85);
  --g-num-amber: rgba(252,210,77,0.85);
  --g-num-rose: rgba(251,113,133,0.78);
  --g-num-teal: rgba(45,212,191,0.78);
  --g-num-purple: rgba(192,132,252,0.7);

  /* ── Typography ── */
  --g-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --g-font-mono: 'Geist Mono Variable', 'SF Mono', monospace;

  /* ── Easing ── */
  --g-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --g-dur: 0.7s;
  --g-dur-fast: 0.4s;

  /* ── Label style ── */
  --g-label-size: 10px;
  --g-label-weight: 500;
  --g-label-spacing: 0.13em;
  --g-label-color: var(--g-text-4);

  /* ── Layout ── */
  background: var(--g-bg);
  color: var(--g-text);
  font-family: var(--g-font);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;

  /* Dot grid */
  background-image: radial-gradient(circle at 1px 1px, var(--g-bg-dot) 1px, transparent 0);
  background-size: var(--g-dot-size) var(--g-dot-size);
}
```

- [ ] **Step 2: Add import to app.css**

Add after the existing editorial imports in `src/app.css`:

```css
@import './styles/tokens-glass.css';
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens-glass.css src/app.css
git commit -m "feat(brand): add glass design token system"
```

---

## Task 2: Reusable GlassCard Component

**Files:**
- Create: `src/lib/components/brands/GlassCard.svelte`

A reusable 3D glass card with configurable color, span, glow, hover, and **expand/collapse** behavior. All section components will use this as their wrapper. Cards have two slots: default (always visible summary) and `expanded` (detail view shown on click). Clicking the card toggles the expanded state. When expanded, the card stretches to full span-12 width with a smooth height animation, and shows the `expanded` slot below the summary.

- [ ] **Step 1: Create GlassCard.svelte**

```svelte
<script lang="ts">
  export let span: 3 | 4 | 6 | 8 | 12 = 6;
  export let color: string = '';
  export let glowSize: number = 80;
  export let glowX: string = 'right';
  export let glowY: string = 'top';
  export let delay: number = 0;
  export let href: string = '';
  export let expandable: boolean = false;  // if true, card has expand/collapse
  export let expandLabel: string = 'View details';  // footer text when collapsed

  let expanded = false;

  function toggle() {
    if (expandable) expanded = !expanded;
  }

  const colorMap: Record<string, { bg: string; glow: string }> = {
    red:     { bg: 'var(--g-red)',     glow: 'rgba(255,50,50,0.06)' },
    green:   { bg: 'var(--g-green)',   glow: 'rgba(52,211,153,0.06)' },
    indigo:  { bg: 'var(--g-indigo)',  glow: 'rgba(99,102,241,0.06)' },
    amber:   { bg: 'var(--g-amber)',   glow: 'rgba(251,191,36,0.06)' },
    rose:    { bg: 'var(--g-rose)',    glow: 'rgba(244,63,94,0.035)' },
    blue:    { bg: 'var(--g-blue)',    glow: 'rgba(59,130,246,0.03)' },
    teal:    { bg: 'var(--g-teal)',    glow: 'rgba(20,184,166,0.03)' },
    purple:  { bg: 'var(--g-purple)',  glow: 'rgba(168,85,247,0.03)' },
    emerald: { bg: 'var(--g-emerald)', glow: 'rgba(16,185,129,0.03)' },
    gold:    { bg: 'var(--g-gold)',    glow: 'rgba(245,158,11,0.025)' },
  };

  $: c = colorMap[color] || { bg: 'var(--g-card-bg)', glow: 'rgba(255,255,255,0.03)' };
  $: glowPos = `${glowY === 'top' ? 'top: -28px' : 'bottom: -28px'}; ${glowX === 'right' ? 'right: -28px' : 'left: -28px'}`;
</script>

<div
  class="gc gc-s{span}"
  class:gc-expanded={expanded}
  style="animation-delay: {delay}s;"
  role={href ? 'link' : 'button'}
  tabindex="0"
  on:click={toggle}
  on:keydown={(e) => e.key === 'Enter' && toggle()}
>
  <div class="gc-edge"></div>
  <div class="gc-glow" style="width: {glowSize}px; height: {glowSize}px; background: {c.glow}; {glowPos}"></div>

  <!-- Summary (always visible) -->
  <div class="gc-content">
    <slot />
  </div>

  <!-- Expand footer -->
  {#if expandable && !expanded}
    <div class="gc-expand-hint">{expandLabel} &rarr;</div>
  {/if}

  <!-- Expanded detail -->
  {#if expandable && expanded}
    <div class="gc-detail">
      <div class="gc-detail-divider"></div>
      <slot name="expanded" />
      <button class="gc-collapse" on:click|stopPropagation={() => expanded = false}>Collapse</button>
    </div>
  {/if}
</div>

<style>
  .gc {
    position: relative;
    overflow: hidden;
    border-radius: var(--g-card-radius, 22px);
    padding: 22px 24px;
    border: 1px solid var(--g-card-border, rgba(255,255,255,0.04));
    box-shadow:
      0 1px 0 0 var(--g-card-highlight, rgba(255,255,255,0.03)) inset,
      0 -1px 0 0 var(--g-card-shadow-bottom, rgba(0,0,0,0.15)) inset,
      var(--g-card-shadow-near, 0 4px 16px rgba(0,0,0,0.12)),
      var(--g-card-shadow-far, 0 12px 40px rgba(0,0,0,0.08));
    backdrop-filter: blur(var(--g-card-blur, 24px));
    -webkit-backdrop-filter: blur(var(--g-card-blur, 24px));
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      border-color var(--g-dur, 0.7s) var(--g-ease, cubic-bezier(0.22,1,0.36,1)),
      box-shadow var(--g-dur, 0.7s) var(--g-ease, cubic-bezier(0.22,1,0.36,1));
    opacity: 0;
    animation: gc-enter 0.7s var(--g-ease, cubic-bezier(0.22,1,0.36,1)) forwards;
  }

  .gc:hover {
    border-color: var(--g-card-border-hover, rgba(255,255,255,0.065));
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.04) inset,
      0 -1px 0 0 rgba(0,0,0,0.12) inset,
      var(--g-card-shadow-hover-near, 0 6px 20px rgba(0,0,0,0.15)),
      var(--g-card-shadow-hover-far, 0 20px 50px rgba(0,0,0,0.12));
  }

  .gc:hover .gc-glow { opacity: 0.65; }

  @keyframes gc-enter {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Top edge highlight */
  .gc-edge {
    position: absolute;
    top: 0; left: 16px; right: 16px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    pointer-events: none;
  }

  /* Inner light on hover */
  .gc::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: var(--g-card-radius, 22px);
    background: linear-gradient(145deg, rgba(255,255,255,0.015), transparent 45%);
    opacity: 0;
    transition: opacity var(--g-dur, 0.7s);
    pointer-events: none;
  }
  .gc:hover::after { opacity: 1; }

  /* Glow orb */
  .gc-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(55px);
    pointer-events: none;
    opacity: 0.3;
    transition: opacity 0.8s var(--g-ease, cubic-bezier(0.22,1,0.36,1));
  }

  /* Content */
  .gc-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Grid spans */
  .gc-s3 { grid-column: span 3; min-height: 148px; }
  .gc-s4 { grid-column: span 4; min-height: 168px; }
  .gc-s6 { grid-column: span 6; min-height: 210px; }
  .gc-s8 { grid-column: span 8; }
  .gc-s12 { grid-column: span 12; }

  /* Expanded state — takes full width */
  .gc-expanded { grid-column: span 12 !important; min-height: auto; }
  .gc-expanded .gc-glow { opacity: 0.5; }

  /* Expand hint footer */
  .gc-expand-hint {
    margin-top: auto;
    padding-top: 16px;
    font-size: 11px;
    color: rgba(255,255,255,0.1);
    letter-spacing: 0.02em;
    transition: color 0.6s var(--g-ease), letter-spacing 0.6s var(--g-ease);
  }
  .gc:hover .gc-expand-hint { color: rgba(255,255,255,0.28); letter-spacing: 0.04em; }

  /* Detail panel */
  .gc-detail {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: detail-enter 0.5s var(--g-ease) both;
  }
  @keyframes detail-enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .gc-detail-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
    margin: 8px 0;
  }
  .gc-collapse {
    align-self: flex-start;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 6px 14px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.02);
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    font-family: inherit;
    transition: color 0.5s, background 0.5s, border-color 0.5s;
    margin-top: 8px;
  }
  .gc-collapse:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.06); }

  @media (max-width: 900px) {
    .gc-s3 { grid-column: span 2; }
    .gc-s4 { grid-column: span 2; }
    .gc-s6 { grid-column: span 4; }
    .gc-s8 { grid-column: span 4; }
    .gc-s12 { grid-column: span 4; }
    .gc-expanded { grid-column: span 4 !important; }
  }
  @media (max-width: 600px) {
    .gc-s3, .gc-s4 { grid-column: span 1; }
    .gc-s6, .gc-s8, .gc-s12 { grid-column: span 2; }
    .gc-expanded { grid-column: span 2 !important; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/GlassCard.svelte
git commit -m "feat(brand): add reusable GlassCard component with 3D depth"
```

---

## Task 3: Rewrite Brands Layout Shell

**Files:**
- Rewrite: `src/routes/brands/+layout.svelte`

Replace the editorial shell with a dark glass shell — minimal top bar, ambient orbs, dot grid.

- [ ] **Step 1: Rewrite the layout**

The layout should:
- Use `.glass-shell` class on the root element (picks up tokens from `tokens-glass.css`)
- Have 4 ambient gradient orbs (red, blue, gold, purple) slowly morphing in the background with `filter: blur(100-120px)` and 38-50s animation cycles
- Minimal top bar: brand avatar (rounded square, gradient) + brand name left, action buttons right (Run Analysis, Create Post, dark mode toggle)
- Section switcher as subtle pill tabs (not the old editorial numbered tabs)
- Dark mode toggle stores preference in localStorage
- Footer removed (fullscreen dashboard, no footer)
- The layout passes `brandAccount` and `brandAuthenticated` from layout server load

Key design specs from the mockup:
- Background: `#08080d` with dot grid (`radial-gradient` at 40px, 1.2% white opacity)
- Ambient orbs: `filter: blur(120px)`, 40-50s linear animation cycles, organic morphing shapes
- Top bar: glass panel with 3D treatment (inner highlight, layered shadow), `backdrop-filter: blur(32px)`
- No `data-editorial-theme` — replaced with `data-glass-theme` for dark/light toggle
- Mobile: stack layout, ambient orbs smaller

- [ ] **Step 2: Commit**

```bash
git add src/routes/brands/+layout.svelte
git commit -m "feat(brand): rewrite layout to dark glass shell with ambient orbs"
```

---

## Task 4: Rewrite BrandStrategist Orchestrator

**Files:**
- Rewrite: `src/lib/components/brands/BrandStrategist.svelte`

Replace the editorial dashboard with the glass bento grid. The component keeps its data loading logic (onMount, reloadData, handleRefresh with phased analysis) but completely changes the template and styles.

- [ ] **Step 1: Rewrite the component**

Structure:
1. **Profile hero card** — full-width glass card with avatar (gradient, rounded-square, breathing ring animation), brand name, handle, bio, stats (followers/posts/eng rate as light 26px numbers), action buttons
2. **Posts strip** — horizontal scroll of recent Instagram post thumbnails, image zoom on hover, overlay with like count
3. **Bento grid** (`display: grid; grid-template-columns: repeat(12, 1fr); gap: 11px`)
4. **Stat cards** (4x span-3): Reach, Saves, Shares, Posts/Week — each using `<GlassCard>` with the color prop
5. **Section divider**: "Intelligence" label (10px, uppercase, 0.18em tracking, 7% white)
6. **Brand Direction** (span-8, red) + **Best Times** (span-4, rose)
7. **Weekly Brief** (span-6, blue) + **Audience DNA** (span-6, teal)
8. **Section divider**: "Opportunities"
9. **Content Ideas** (span-6, purple) + **Creator Matches** (span-6, emerald)
10. **Competitor Watch** (span-12, gold)
11. Each section that has no data shows an inline "Generate" / "Analyse" / "Fetch" button (same as current retry buttons but styled as glass buttons)

Data loading stays exactly the same: `onMount → reloadData()`, `handleRefresh → phased runPhase calls`, proposal actions, competitor add.

Key hover behavior (from approved mockup):
- Cards: NO translateY on hover. Only border-color change + shadow depth increase + inner light gradient appears
- Numbers: letter-spacing eases from -0.05em to -0.03em (barely perceptible breathing)
- Footer text ("Expand →"): letter-spacing eases wider on hover
- Tags: background lightens slightly on parent card hover
- All transitions: 0.7s with `cubic-bezier(0.22, 1, 0.36, 1)`

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/BrandStrategist.svelte
git commit -m "feat(brand): rewrite BrandStrategist as glass bento dashboard"
```

---

## Task 5: Rewrite All Section Components

**Files:**
- Rewrite: `src/lib/components/brands/StratWeeklyBrief.svelte`
- Rewrite: `src/lib/components/brands/StratProposals.svelte`
- Rewrite: `src/lib/components/brands/StratBrandDirection.svelte`
- Rewrite: `src/lib/components/brands/StratEngagementBreakdown.svelte`
- Rewrite: `src/lib/components/brands/StratAudienceDNA.svelte`
- Rewrite: `src/lib/components/brands/StratPostingHeatmap.svelte`
- Rewrite: `src/lib/components/brands/StratContentIdeas.svelte`
- Rewrite: `src/lib/components/brands/StratCompetitorWatch.svelte`

Each component keeps its existing props and logic but rewrites the template and styles to use glass design tokens. They no longer wrap themselves in `<section>` with editorial styles — the parent `BrandStrategist` wraps them in `<GlassCard>`.

Design specs per component (summary → expanded):

**StratWeeklyBrief:**
- Summary: Brief headline, "What's Working" / "What's Not" as compact text
- Expanded: Full key metrics table (each metric with current value + delta badge), recommended moves, audience shift notes, competitor moves

**StratProposals:**
- Summary: Top 3 proposals as compact cards with type badge + title
- Expanded: All proposals with full reasoning, caption drafts for content proposals, suggested outreach messages for creator matches, approve/reject buttons

**StratBrandDirection:**
- Summary: Brand direction quote, 4 content pillar tags
- Expanded: Full voice guidelines, competitive gaps analysis, big bet recommendation, all quick wins, full brand DNA breakdown (aesthetic, lifestyle, vibes, interests, personality scores)

**StratEngagementBreakdown:**
- Summary: 4 inline stats (rate, avg per post, posts/week, growth trend)
- Expanded: Content type performance bars, top posts thumbnails, all hashtags with frequency counts, saves/shares breakdown

**StratAudienceDNA:**
- Summary: Audience narrative text + 3 inline stats (gender, age, top city)
- Expanded: Full age bucket bars, gender breakdown, all cities, all countries, persona cards with descriptions

**StratPostingHeatmap:**
- Summary: Peak slot + best day as light numbers, mini heatmap row
- Expanded: Full 7x24 heatmap grid, all peak slots listed, best 3 hours

**StratContentIdeas:**
- Summary: 3 idea rows (format badge + title)
- Expanded: All 5 ideas with full caption drafts, hashtag sets, optimal time, reasoning, content pillar mapping

**StratCompetitorWatch:**
- Summary: Add handle input, competitor count, matrix summary (overlaps/gaps/positioning as one-liners)
- Expanded: Full competitor cards with followers, engagement rate, aesthetic, content themes, format mix, summary, last analysed timestamp

All components use these shared patterns:
- Labels: `font-size: var(--g-label-size); font-weight: var(--g-label-weight); letter-spacing: var(--g-label-spacing); text-transform: uppercase; color: var(--g-label-color);`
- Body text: `font-size: 14px; color: var(--g-text-3); line-height: 1.7;`
- Numbers: `font-weight: 300; letter-spacing: -0.04em; color: var(--g-num-*);`
- Tags: `font-size: 10px; padding: 4px 12px; border-radius: 9px; background: rgba(255,255,255,0.025); color: var(--g-text-4); border: 1px solid rgba(255,255,255,0.02);`

- [ ] **Step 1: Rewrite all 8 components**

Each component follows the same pattern — keeps its `<script>` section (props, logic, event dispatchers) but replaces the `<template>` and `<style>` with glass design language. The parent wraps them in `<GlassCard>`, so these components only render their INNER content (no outer card styling needed).

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/Strat*.svelte
git commit -m "feat(brand): rewrite all section components with glass design"
```

---

## Task 6: Rewrite Creator Index Page

**Files:**
- Rewrite: `src/routes/brands/creators/+page.svelte`

Replace the editorial Creator Index with a glass bento grid of creator cards.

- [ ] **Step 1: Rewrite the page**

Structure:
- Page uses `.glass-shell` styling (inherited from layout)
- Featured creator as a wide glass card (span-12) with avatar image, name, stats, bio
- Creator grid as bento (12-col) with varying card sizes (span-3, span-4, span-6)
- Each creator card: profile photo, name, stats row (followers/posts/signal), strength bar, badges, tags
- Click to expand: inner detail panel slides open with brand vibes, personality bars, color palette
- Search input: underline-style on dark glass
- Filter chips: glass pills

- [ ] **Step 2: Commit**

```bash
git add src/routes/brands/creators/+page.svelte
git commit -m "feat(brand): rewrite Creator Index with glass bento grid"
```

---

## Task 7: Update Portal Page

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

Remove editorial references and ensure the portal page works with the glass shell.

- [ ] **Step 1: Clean up portal page**

- Remove any `editorial-shell` or `ed-*` CSS class references
- Ensure `.brand-studio` wrapper works inside the glass shell
- Keep all data loading, tab switching, and content studio logic
- Portal tabs (if still present) should use glass styling

- [ ] **Step 2: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat(brand): update portal page for glass shell"
```

---

## Task 8: Deploy and Verify

- [ ] **Step 1: Type check**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run check 2>&1 | grep -i error | grep -v 'Unused CSS' | grep -v 'css_unused_selector'
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Deploy**

```bash
vercel --prod --force
```

- [ ] **Step 4: Alias**

```bash
vercel alias <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 5: Verify**

Visit https://wagwanworld.vercel.app/brands/portal logged in. Confirm:
- Dark glass background with dot grid and ambient orbs
- Profile hero card with 3D depth
- Posts strip with horizontal scroll
- Bento grid with all sections as glass cards
- Hover: smooth border + shadow transitions, no jank
- Mobile: 2-column grid, stacked profile, touch-friendly
- Dark mode toggle works
- Run Analysis phases still work
- Creator Index at /brands/creators uses glass design

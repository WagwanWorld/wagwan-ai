# Dashboard Living Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Brand OS dashboard into a "Living Dashboard" with color-coded gradient cards, Inter 800 numbers (killing Bodoni serif), inline demographics, and all follower analytics on the Content Studio home page.

**Architecture:** Pure CSS/template changes across 5 existing Svelte components + 1 layout file. No new components, no new endpoints, no logic changes. The FollowerAnalyticsPanel loses its header (dashboard already has one) and its summary cards (metrics live in BrandOsDashboard now). Demographics become a 4-column inline row. The Follower Analytics sidebar tab is removed.

**Tech Stack:** SvelteKit, CSS (inline `<style>` blocks), SVG charts

**Spec:** `docs/superpowers/specs/2026-05-12-dashboard-living-redesign.md`

---

### Task 1: Restyle BrandOsDashboard — Typography & Card Colors

**Files:**

- Modify: `src/lib/components/brands/BrandOsDashboard.svelte`

The core visual overhaul. Kill Bodoni, add gradient cards, brighten labels, bigger numbers.

- [ ] **Step 1: Replace all Bodoni Moda font references with Inter**

In `src/lib/components/brands/BrandOsDashboard.svelte`, find every occurrence of `'Bodoni Moda', Georgia, serif` and replace with `'Inter', 'Geist Variable', sans-serif`. There are instances in these CSS classes:

- `.bs-metric-num` (line ~637)
- `.bs-num-sm` (line ~641)
- `.bs-health-num` (line ~618)
- `.bs-pipeline-num` (line ~1003)
- `.bs-campops-active` (line ~976)

Also increase font-weight from 700 to 800 on `.bs-metric-num` and `.bs-health-num`.

- [ ] **Step 2: Add color-coded gradient backgrounds to metric cards**

Replace the generic `.bs-card` background with color-specific variants. Add these new CSS classes after the existing `.bs-card` definition:

```css
/* Color-coded metric cards */
.bs-metric-orange {
  background: linear-gradient(145deg, rgba(232, 131, 58, 0.15), rgba(232, 131, 58, 0.03));
  border-color: rgba(232, 131, 58, 0.2);
}
.bs-metric-orange .bs-label {
  color: #e8833a;
}

.bs-metric-green {
  background: linear-gradient(145deg, rgba(74, 222, 128, 0.1), rgba(74, 222, 128, 0.03));
  border-color: rgba(74, 222, 128, 0.15);
}
.bs-metric-green .bs-label {
  color: #4ade80;
}

.bs-metric-blue {
  background: linear-gradient(145deg, rgba(77, 124, 255, 0.1), rgba(77, 124, 255, 0.03));
  border-color: rgba(77, 124, 255, 0.12);
}
.bs-metric-blue .bs-label {
  color: #4d7cff;
}

.bs-metric-pink {
  background: linear-gradient(145deg, rgba(232, 127, 168, 0.08), rgba(232, 127, 168, 0.02));
  border-color: rgba(232, 127, 168, 0.12);
}
.bs-metric-pink .bs-label {
  color: #e87fa8;
}
```

- [ ] **Step 3: Apply color classes to metric cards in the template**

Update the template HTML to add color classes:

- Followers card: add `bs-metric-orange`
- Eng Rate card: add `bs-metric-green`
- Reach card: add `bs-metric-blue`
- Avg Saves card: add `bs-metric-orange`
- Shares card: add `bs-metric-pink`
- Profile Views card: add `bs-metric-blue`
- Posts/Week card: leave neutral (no extra class)

- [ ] **Step 4: Make the hero Followers card larger**

The first metric card (Followers) should be wider. Change the ROW 2 grid from `repeat(3, 1fr)` to handle a 2fr first column. In the template, give the Followers `.bs-metric` card an additional class `bs-metric-hero` and add CSS:

```css
.bs-metric-hero .bs-metric-num {
  font-size: 36px;
  letter-spacing: -0.03em;
}
```

The ROW 2 comment section's parent grid (in the portal page's `.bos-root` grid) handles column sizing, but the dashboard component uses `display: contents` so cards flow into the parent grid. The hero card just needs bigger text — the grid handles sizing.

- [ ] **Step 5: Add sub-context labels under numbers**

Add a `.bs-metric-context` class for the small contextual text under numbers:

```css
.bs-metric-context {
  font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 2px;
}
```

Add context spans in the template after each metric number where appropriate:

- Engagement Rate: `<span class="bs-metric-context">{note}</span>` (shows "148 interactions (7d)")
- Reach: `<span class="bs-metric-context">{note}</span>` (shows "Live from IG")
- Saves/Shares: already have `.bs-metric-sub` showing "per post"

- [ ] **Step 6: Style delta badges as green chips**

Replace the plain text delta with a chip style:

```css
.bs-delta-chip {
  display: inline-block;
  font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.bs-delta-chip.bs-delta-green {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}
.bs-delta-chip.bs-delta-red {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
```

Update the delta `<span>` elements in the template to use `bs-delta-chip` class alongside `bs-delta-green`/`bs-delta-red`.

- [ ] **Step 7: Brighten the brief card gradient**

Update `.bs-brief` to use a more visible gradient:

```css
.bs-brief {
  grid-column: span 2;
  background: linear-gradient(145deg, rgba(232, 131, 58, 0.1), rgba(232, 131, 58, 0.03));
  border-color: rgba(232, 131, 58, 0.15);
}
```

- [ ] **Step 8: Build and verify**

Run: `npx vite build 2>&1 | grep -E "✔|error"` — expect `✔ done`

---

### Task 2: Restyle FollowerAnalyticsPanel — Strip Header, Simplify

**Files:**

- Modify: `src/lib/components/brands/FollowerAnalyticsPanel.svelte`

Remove the panel's own header/action bar (the BrandOsDashboard action bar handles period toggle and refresh). Remove the summary cards row (metrics now live in BrandOsDashboard). Keep: demographics, growth chart, momentum, reach mix, heatmap, post attribution.

- [ ] **Step 1: Remove the panel header and summary cards from template**

In the template, remove the `fa-header` div and the `fa-summary-row` div entirely. The panel should start directly with the growth chart + momentum row.

Also remove the `fa-collect-status` and `fa-error` divs — move error handling to a simpler inline message.

- [ ] **Step 2: Simplify the panel to just render sub-components**

The panel template should be:

```html
<div class="fa-panel">
  {#if error}
  <div class="fa-error">{error}</div>
  {/if} {#if loading && !growth}
  <div class="fa-loading">Loading follower analytics...</div>
  {:else}
  <!-- Demographics inline row -->
  <FollowerDemographics ... />

  <!-- Growth + Momentum -->
  <div class="fa-row-2col">
    <FollowerGrowthChart ... />
    <FollowerMomentum ... />
  </div>

  <!-- Reach mix -->
  {#if reachMix}
  <div class="fa-reach-bar">...</div>
  {/if}

  <!-- Heatmap -->
  <FollowerActivityHeatmap ... />

  <!-- Post attribution -->
  <FollowerPostAttribution ... />
  {/if}
</div>
```

- [ ] **Step 3: Remove unused CSS**

Delete the CSS for: `.fa-header`, `.fa-header-left`, `.fa-title`, `.fa-subtitle`, `.fa-controls`, `.fa-range-toggle`, `.fa-range-btn`, `.fa-range-active`, `.fa-refresh-btn`, `.fa-collect-status`, `.fa-summary-row`, `.fa-stat-card`, `.fa-stat-label`, `.fa-stat-num`, `.fa-stat-sub`, `.fa-positive`, `.fa-negative`.

- [ ] **Step 4: Replace Bodoni in remaining styles**

Search for any `'Bodoni Moda'` references in this file and replace with `'Inter', 'Geist Variable', sans-serif`. Increase font-weight to 800 where used for numbers.

- [ ] **Step 5: Build and verify**

Run: `npx vite build 2>&1 | grep -E "✔|error"` — expect `✔ done`

---

### Task 3: Restyle FollowerDemographics — 4-Column Inline Row

**Files:**

- Modify: `src/lib/components/brands/FollowerDemographics.svelte`

Change from 2x2 grid to 4-column inline row with color-coded cards per breakdown.

- [ ] **Step 1: Change grid layout from 2x2 to 4 columns**

Update the container grid CSS from `grid-template-columns: 1fr 1fr` (2x2) to `grid-template-columns: repeat(4, 1fr)`. Remove the second row.

- [ ] **Step 2: Apply color system to each quadrant**

- Gender card: green border/bg (`rgba(74,222,128,...)`)
- Age card: blue border/bg (`rgba(77,124,255,...)`)
- Top Cities card: orange border/bg (`rgba(232,131,58,...)`)
- Top Countries card: pink border/bg (`rgba(232,127,168,...)`)

Each card should use the same gradient pattern: `linear-gradient(145deg, rgba(hue, 0.06), rgba(hue, 0.02))` with `border: 1px solid rgba(hue, 0.12)`.

- [ ] **Step 3: Compact the content for inline display**

Each card shows max 3 items (not 5) to fit the narrower inline columns. The gender donut should be smaller (32px diameter). Age bars shorter. City/country lists show top 3 only.

- [ ] **Step 4: Make responsive — stack to 2 columns on tablet, 1 on mobile**

```css
@media (max-width: 768px) {
  .demo-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 480px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Build and verify**

Run: `npx vite build 2>&1 | grep -E "✔|error"` — expect `✔ done`

---

### Task 4: Restyle FollowerMomentum & FollowerGrowthChart Cards

**Files:**

- Modify: `src/lib/components/brands/FollowerMomentum.svelte`
- Modify: `src/lib/components/brands/FollowerGrowthChart.svelte`

- [ ] **Step 1: FollowerMomentum — replace Bodoni with Inter 800**

Find `'Bodoni Moda'` or serif font references in the momentum number. Replace with `'Inter', 'Geist Variable', sans-serif` weight 800.

- [ ] **Step 2: FollowerGrowthChart — replace any Bodoni references**

Same font swap. Ensure axis labels use Geist Mono and data values use Inter 700.

- [ ] **Step 3: Update card wrapper backgrounds**

Both components use `.bs-card` style wrappers. Update their card backgrounds to use the subtle gradient pattern:

```css
background: rgba(255, 255, 255, 0.04);
border: 1px solid rgba(255, 255, 255, 0.08);
```

This is lighter than the current `0.035` — slightly more visible.

- [ ] **Step 4: Build and verify**

Run: `npx vite build 2>&1 | grep -E "✔|error"` — expect `✔ done`

---

### Task 5: Remove Follower Analytics Tab + Portal Layout Integration

**Files:**

- Modify: `src/routes/brands/+layout.svelte`
- Modify: `src/routes/brands/portal/+page.svelte`

- [ ] **Step 1: Remove Follower Analytics from sidebar nav**

In `src/routes/brands/+layout.svelte`, remove the `{ num: '05', label: 'Follower Analytics', href: '/brands/portal?tab=followers' }` entry from the `sections` array. Renumber "Profile & Insights" back to `05`.

Update the `activeSection` reactive expression to remove the `portalTabParam === 'followers' ? '05'` condition.

- [ ] **Step 2: Remove the followers tab conditional in portal page**

In `src/routes/brands/portal/+page.svelte`, remove the `{:else if portalTab === 'followers' && data.brandProfile}` block and its contents.

Remove `'followers'` from the `portalTab` type union (revert to `'content' | 'creators' | 'profile' | 'automation'`).

Remove `'followers'` from the `urlTab` cast and the `includes()` check.

- [ ] **Step 3: Verify FollowerAnalyticsPanel is still rendered in Content Studio**

Confirm the `<FollowerAnalyticsPanel />` component is still rendered in the content tab section (added in previous work), between BrandOsDashboard and the campaigns list.

- [ ] **Step 4: Build and verify**

Run: `npx vite build 2>&1 | grep -E "✔|error"` — expect `✔ done`

---

### Task 6: Deploy and Verify

**Files:** None (deployment)

- [ ] **Step 1: Build final**

Run: `npx vite build` — expect clean build

- [ ] **Step 2: Deploy to production**

Run: `vercel --prod` — expect READY status

- [ ] **Step 3: Verify in browser**

Visit wagwanworld.vercel.app, navigate to Content Studio. Verify:

- No Bodoni serif fonts visible on any number
- Metric cards have color-coded gradient backgrounds
- Demographics show as 4-column inline row below secondary metrics
- Follower Analytics tab is gone from sidebar
- Growth chart + heatmap + post attribution render below demographics
- Action bar period toggle and buttons still work

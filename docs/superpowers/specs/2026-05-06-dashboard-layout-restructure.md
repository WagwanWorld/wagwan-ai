# Dashboard Layout Restructure

**Date:** 2026-05-06
**Status:** Approved
**Workstream:** 2 of 4 (Theme → Layout → Creator Intelligence → Brand Matching)

## Problem

The current dashboard layout doesn't prioritize brand matching — the primary action for creators. Brand requests and briefs are buried as equal-weight cards in a flat bento grid. Chat occupies a separate nav tab instead of being embedded on the home page. Watch Tonight and Read Next take up too much vertical space as separate full-width sections.

## Design

### 1. Remove Chat from navigation

**Sidebar (`DesktopSidebar.svelte`)**: Remove the Chat link. Nav becomes:

- Home
- Earn
- Profile
- (Footer: "For brands")

**Mobile nav (`FloatingNav.svelte`)**: Remove the Chat tab. Tabs become:

- Home · Earn · Profile

Chat aside stays on the home page as the right column on desktop (existing behavior). Hidden on mobile (existing behavior — already has `display: none` at ≤1279px).

The `/ai` route stays functional (direct URL access still works) but is no longer surfaced in navigation.

### 2. Reorder bento grid sections

Current order:

1. Identity → 2. Brands → 3. Requests → 4. Metrics → 5. Watch → 6. Books → 7. Activity → 8. DNA

New order:

1. **Brand Requests** (span 2 cols) — primary action, most prominent
2. **Brands in Ecosystem** (span 1 col)
3. **Your Identity** (span 1 col)
4. **Creator Metrics** (span 1 col)
5. **Watch Tonight + Read Next** (span 2 cols, side by side internally)
6. **Creator DNA** (span 3 cols, full width)
7. **Recent Activity** (span 1 col) — only shown if transactions exist

### 3. Brand Requests card — make it prominent

The brand requests card becomes the hero of the bento grid:

- Spans 2 columns on desktop (currently spans 1)
- Gets Tier 2 glass treatment (already applied in workstream 1)
- Brief cards inside get more breathing room (increase padding)
- Empty state message becomes more inviting: "No briefs yet — brands are discovering your signal portrait"

### 4. Watch Tonight + Read Next — side by side

Instead of two separate full-width rows, combine into a single card that spans 2 columns:

- **Left half**: "Watch Tonight" with horizontal scroll of poster cards
- **Right half**: "Read Next" with horizontal scroll of book covers
- Shared card container with a vertical divider between halves
- Each half has its own horizontal scroll with `overflow-x: auto`
- Card height constrained to ~200px to keep it compact
- Section label above each half inside the shared container

### 5. Grid layout adjustments

Desktop (≥1280px) bento grid:

```
grid-template-columns: repeat(3, 1fr)
```

| Row | Col 1                   | Col 2               | Col 3                |
| --- | ----------------------- | ------------------- | -------------------- |
| 1   | Brand Requests (span 2) | Brands in Ecosystem |
| 2   | Your Identity           | Creator Metrics     | (activity if exists) |
| 3   | Watch + Read (span 2)   | (activity or empty) |
| 4   | Creator DNA (span 3)    |                     |                      |

Tablet (768–1279px):

```
grid-template-columns: repeat(2, 1fr)
```

Brand Requests spans full width (2 cols). Watch+Read spans full width. Others are 1 col each.

Mobile (<768px):

```
grid-template-columns: 1fr
```

All single column. Watch+Read stacks vertically (each half becomes full width).

## Scope

- **HTML changes**: Reorder the bento card elements in `home/+page.svelte`
- **New component**: Combined Watch+Read card (replace two separate cards)
- **Nav changes**: Remove Chat link from `DesktopSidebar.svelte` and `FloatingNav.svelte`
- **CSS changes**: Grid spans, combined media card styles, responsive breakpoints
- **No backend changes**: All data sources stay the same
- **No data changes**: Same content, different arrangement

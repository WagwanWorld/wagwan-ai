# Brand OS Dashboard Redesign

**Date:** 2026-04-25  
**Status:** Approved  
**Goal:** Redesign the brand portal Content Studio tab into a true Brand OS bento dashboard — conversational, visual, metric-rich, matching the Personal OS creator dashboard aesthetic.

---

## Problem

The current brand portal renders data through 6 `BrandPortal*` components (`BrandPortalExecutive`, `BrandPortalAudienceInsights`, `BrandPortalSynopsis`, `BrandKitPanel`, `BrandPortalCampaignOps`, `BrandPortalContentOps`) that produce unformatted, clinical output. The page feels like a spreadsheet — no visual warmth, no conversational tone, no color, no Instagram imagery.

## Design Direction

**Hybrid: Magazine Editorial + Conversational OS**

- Editorial narrative headlines (like a weekly magazine cover story about your brand)
- Conversational insight cards with italic quoted advice ("Your event recaps are getting 3x more saves — lean into this")
- Rich metrics with mini sparklines, bar charts, and a composite Brand Health ring
- Instagram post thumbnails with engagement overlays (likes + saves + type badges)
- Brand palette shown as color swatches
- Color-coded left borders on insight cards (green/red/amber)
- Same dark bento grid foundation as Personal OS (`#0A0A0C`, 14px radius, Geist Mono labels)

---

## Card Inventory (12 cards)

### Row 1: Brief + Health

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Weekly Brief** | 2 cols | `synopsis` | Editorial headline + narrative paragraph. Subtle warm gradient glow orb in corner. |
| **Brand Health** | 1 col | Computed from metrics | Radial ring (SVG circle), composite score number (0-100), color-coded label (Good/Fair/Low). Radial gradient background. |

### Row 2: Primary Metrics (3 cards)

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Followers** | 1 col | `executive.metrics` | Bodoni Moda 24px number. Green "+N this week" delta. Mini sparkline (7 bars, green). |
| **Eng. Rate** | 1 col | `executive.metrics` | Bodoni Moda 24px number + % suffix. Mini bar chart (5 bars, blue). |
| **Reach (7d)** | 1 col | `executive.metrics` | Bodoni Moda 24px number. Red/green delta %. Mini sparkline (7 bars, colored by trend). |

### Row 3: Secondary Metrics (3 cards)

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Avg. Saves** | 1 col | `executive.metrics` | Bodoni Moda 20px, "per post" sublabel. |
| **Shares** | 1 col | `executive.metrics` | Bodoni Moda 20px, "per post avg" sublabel. |
| **Posts/Week** | 1 col | `executive.metrics` | Bodoni Moda 20px. Amber "increase recommended" if < 2. |

### Row 4: Insight Cards (3 cards)

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **What's Working** | 1 col | `synopsis.sections` | Green left border (3px). Green label. Italic body text in quotes. |
| **What's Not** | 1 col | `synopsis.sections` | Red left border. Red label. Italic body text in quotes. |
| **Do This Week** | 1 col | `synopsis.whatNext` | Amber left border + amber tinted background. Numbered action list. |

### Row 5: Instagram Posts (full width)

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Recent Posts** | full | IG API (via `executive` or snapshot `recentPosts`) | Horizontal scroll strip. 100px thumbnails (real images via `thumbnail` URL, gradient placeholder fallback). Bottom overlay gradient with likes + saves count. REEL/CAROUSEL type badge top-left. |

### Row 6: Brand Direction + Audience

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Brand Direction** | 2 cols | `brandKit.messagingPillars`, `audienceInsights.summary` | Description paragraph. Vibe tags as chips. Color palette as swatches (4 circles) + mood label. |
| **Your Audience** | 1 col | `audienceInsights` | One-sentence description in italic quotes. Age/Gender/City breakdown row below separator. |

### Row 7: Ideas + Matches + Ops

| Card | Span | Source | Visual Treatment |
|------|------|--------|-----------------|
| **Content Ideas** | 1 col | `brandKit.contentCalendar` or proposals | List with title + format tag (color-coded: amber REEL, blue CAROUSEL, muted POST). Count badge in header. |
| **Creator Matches** | 1 col | Proposals `type === 'creator_match'` | Avatar circle (gradient), @handle, follower count + niche, match % (green >80, amber >60). Count badge in header. |
| **Campaign Ops** | 1 col | `campaignOps` + `contentOps` | Active campaign count or "No active campaigns" italic. Content Pipeline: Draft/Sched/Live/Fail as Bodoni numbers. Best Time to Post below separator. |

---

## Typography

| Element | Font | Size | Weight | Color | Extra |
|---------|------|------|--------|-------|-------|
| Card labels | Geist Mono Variable | 8-9px | 600 | `#4A4A50` | uppercase, 0.1em tracking |
| Metric numbers | Bodoni Moda, Georgia | 20-24px | 700 | `#EDEDEF` | -0.02em tracking |
| Body text | Geist Variable, Inter | 11-12px | 400 | `#EDEDEF` | 1.6 line-height |
| Conversational quotes | Geist Variable | 11px | 400 | `#EDEDEF` | italic |
| Delta/sublabel | Geist Mono Variable | 8-9px | 600 | trend-colored | monospace |
| Brief headline | Geist Variable | 15-16px | 700 | `#EDEDEF` | -0.02em tracking |

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0A0C` | Page and card grid background |
| Card surface | `rgba(255,255,255,0.035)` | Card backgrounds |
| Card border | `rgba(255,255,255,0.07)` | Default border, `0.12` on hover |
| Primary text | `#EDEDEF` | Names, numbers, body text |
| Secondary text | `#6A6A72` | Bio, descriptions |
| Muted text | `#4A4A50` | Labels |
| Ghost text | `#3A3A40` | Sublabels, dates |
| Accent amber | `#E8833A` | Primary action, "Do This Week", format tags |
| Success green | `#4ade80` | "What's Working", positive delta, high match % |
| Danger red | `#f87171` | "What's Not", negative delta |
| Info blue | `#4d7cff` | Engagement bars, CAROUSEL tags |

## Visual Elements

### Mini Sparkline
- 7 vertical bars, 4px wide, 2px gap
- Height proportional to data (40%-80% range)
- Color matches trend: green for up, red for down
- Opacity gradient (older bars more transparent)

### Engagement Bar Chart
- 5 bars filling available width
- Color: `rgba(77,124,255,0.3)` with height variation
- 2px border-radius

### Brand Health Ring
- SVG circle, 72px diameter
- 3px stroke: background `rgba(255,255,255,0.06)`, progress colored by score
- Score 70+: green. 40-69: amber. <40: red.
- Radial gradient background on card

### Instagram Post Thumbnails
- 100px x 100px, 10px border-radius
- Real `thumbnail` image from API, gradient placeholder fallback
- Bottom overlay: `linear-gradient(transparent, rgba(0,0,0,0.7))` with likes + saves
- Top-left type badge for REEL/CAROUSEL: `rgba(0,0,0,0.5)` background, monospace 7px

### Color Palette Swatches
- 22px circles with 6px border-radius
- Extracted from `brandKit.visualDirection.palette` or hardcoded brand colors
- Mood label in monospace next to swatches

---

## Data Source Mapping

The portal already fetches `GET /api/brand/os-dashboard` which returns `BrandOsDashboard`:

```
osDashboard.executive       → top bar identity, metrics (6 cards)
osDashboard.synopsis        → brief headline, whats_working, whats_not, whatNext
osDashboard.audienceInsights → audience card, demographics
osDashboard.brandKit        → direction, palette, vibe tags, content ideas
osDashboard.campaignOps     → campaign ops card
osDashboard.contentOps      → content pipeline counts
```

**Instagram posts** — need to be added to the API response or fetched separately. Check if `executive` already includes `recentPosts` from the intelligence snapshot. If not, add a `recentPosts` field to the os-dashboard response.

**Brand Health score** — computed client-side from available metrics: engagement_rate, reach delta, posting frequency, save rate. Simple weighted average.

**Sparkline data** — if the API doesn't return historical arrays, use the single-point data with synthetic variation for v1. Add real time-series in a follow-up.

---

## Implementation Approach

**Rewrite the 6 `BrandPortal*` components** into a single self-contained `BrandOsDashboard.svelte` component (~400-500 lines) that:

1. Accepts the `osDashboard: BrandOsDashboard` prop
2. Renders all 12 cards directly (no sub-component delegation)
3. Uses scoped `<style>` with hardcoded OS design tokens (no CSS variable dependencies)
4. Includes the sparkline/bar chart/ring as inline SVG or CSS

**Files to modify:**
- `src/lib/components/brands/BrandOsDashboard.svelte` — NEW, the single dashboard component
- `src/routes/brands/portal/+page.svelte` — replace the 6 component calls with `<BrandOsDashboard {osDashboard} />`
- `src/routes/api/brand/os-dashboard/+server.ts` — add `recentPosts` to response if missing

**Files NOT modified** (kept for other tabs/features):
- All existing `BrandPortal*.svelte` components (can be deleted later)
- `BrandStrategist.svelte` (used by other flows)

## Responsive Behavior

| Breakpoint | Grid | Adaptations |
|-----------|------|-------------|
| >1024px | 3 columns | Full bento layout as designed |
| 640-1024px | 2 columns | Brief spans full, Direction spans full, Posts spans full |
| <640px | 1 column | All cards stack, sparklines still render, post strip scrolls |

---

## Out of Scope

- Content Studio posting UI (separate tab/component)
- Creator matching flow (separate tab)
- Profile & Insights tab
- Real-time updates / WebSocket
- Historical time-series API (use synthetic sparklines for v1)

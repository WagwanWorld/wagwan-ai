# Brand Dashboard Redesign

**Date**: 2026-04-16
**Status**: Approved
**Scope**: Redesign the brand portal results page into a campaign proposal dashboard

## Problem

The current results page shows placeholder creator cards with minimal data. The API returns rich signals (match breakdowns, creator rates, graph strength, content tags) that aren't surfaced. The page should feel like a brand dashboard where a brand evaluates a matched audience package and launches a campaign.

## Design

### Architecture

All changes are in the frontend. No API changes required — all data is already available from existing endpoints:
- `/api/brand/search-audience` — match scores, breakdowns, rates, graph strength, tags
- `/api/brand/creators` — network creators for empty state
- `/api/brand/audience-intelligence` — narrative intel
- `/api/brand/member-brief` — per-creator briefs
- `/api/brand/create-campaign` — campaign persistence

The portal page (`src/routes/brands/portal/+page.svelte`) currently handles both the manual search flow and the guided agent flow. The results display is inline in the 1899-line portal file. The redesign extracts result display into focused components.

### Component Breakdown

```
src/routes/brands/portal/+page.svelte (existing, modify results section)
src/lib/components/brands/
  ├── BrandIntakeCard.svelte     (existing, minor overflow fix already done)
  ├── GuidedQuestions.svelte     (existing, no changes)
  ├── ThinkingStepper.svelte     (existing, no changes)
  ├── ResultsDashboard.svelte    (existing, full rewrite)
  ├── DashboardSummaryBar.svelte (new)
  ├── CreatorCard.svelte         (new)
  ├── AudienceIntelPanel.svelte  (new — extract from portal)
  ├── StickyLaunchBar.svelte     (new)
  └── LaunchModal.svelte         (new — replaces side panel)
```

### Section 1: Summary Bar (`DashboardSummaryBar.svelte`)

Horizontal row of 6 metric cards at the top of results.

**Props:**
```typescript
{
  creatorCount: number;          // total matched
  selectedCount: number;         // currently selected
  totalReach: number;            // sum of follower counts of selected
  estimatedCost: number | null;  // sum of selected creator rates (default: post rate)
  avgMatchScore: number;         // 0-100
  keyTraits: { tag: string; count: number }[];  // top 5
  pctHighStrength: number;       // 0-100
}
```

**Cards:**

| # | Label | Value | Detail |
|---|-------|-------|--------|
| 1 | Matched Creators | `{creatorCount}` | "creators found" |
| 2 | Est. Total Reach | formatted sum of followers | of selected creators |
| 3 | Est. Campaign Cost | `₹{cost}` | updates on selection change. Null = "Set rates to estimate" |
| 4 | Match Quality | `{avg}% avg` | Color: green >75, amber >50, gray below |
| 5 | Top Signals | top 5 key_traits as pills | truncate to fit |
| 6 | Graph Depth | `{pct}% strong` | profiles with graph_strength >= 65 |

Cards 2 and 3 are reactive to selection state.

Layout: CSS grid, `grid-template-columns: repeat(3, 1fr)` on desktop, `repeat(2, 1fr)` on tablet, single column on mobile.

### Section 2: Creator List (rewritten `ResultsDashboard.svelte` + new `CreatorCard.svelte`)

**ResultsDashboard** renders the full results area: summary bar, creator grid, audience intel, sticky bar.

**CreatorCard Props:**
```typescript
{
  user: AudienceSearchUserRow;  // full user object from search-audience
  selected: boolean;
  onToggle: () => void;
  onExpand: () => void;
}
```

**Card layout (collapsed):**
```
[Checkbox]                              [Follower count]
[Avatar] [Name]
         [@handle] · [City]
[Match badge: "85% match"]  [Graph strength badge]
[Rates: post ₹X · story ₹Y · reel ₹Z]
[Tag pills: fitness · wellness · lifestyle]
[Match reason: 2-line clamp]
```

**Card layout (expanded — on click):**
Adds below the collapsed content:
- 4 horizontal mini-bars showing match_score_breakdown:
  - Interest match (0-100)
  - Behavior match (0-100)
  - Intent signal (0-100)
  - Engagement probability (0-100)
- "Generate brief" button → calls `/api/brand/member-brief`
- Brief content (happening_now, do_next, missing) displayed inline when loaded

**Grid:** 2 columns on desktop, 1 on mobile. `gap: 1rem`.

**Selection:** All creators selected by default. Checkbox toggles. Selected cards get accent border.

**Match badge colors:**
- Green (emerald): score >= 75
- Amber: score >= 50
- Gray: score < 50

**Graph strength badge:** Same existing encoding (emerald/amber/zinc).

**Rates display:**
- If `rates.available`: show "post ₹X · story ₹Y · reel ₹Z"
- If not available: show "Rates not set" in muted text

### Section 3: Audience Intelligence (`AudienceIntelPanel.svelte`)

Extracted from the existing portal page inline code. Same functionality, same API call, just in its own component.

**Props:**
```typescript
{
  users: AudienceSearchUserRow[];
  structured: ParsedAudience;
  keyTraits: { tag: string; count: number }[];
}
```

**Layout:** "Generate Intelligence" button. Results in 2x2 grid of narrative cards:
- Trying to achieve
- Struggling with
- Content that converts
- Will pay for

### Section 4: Sticky Launch Bar (`StickyLaunchBar.svelte`)

Fixed to bottom of viewport. Only visible when results are loaded.

**Props:**
```typescript
{
  selectedCount: number;
  totalCount: number;
  totalReach: number;
  estimatedCost: number | null;
  costBreakdown: { posts: number; stories: number; reels: number };
  onLaunch: () => void;
  disabled: boolean;  // true when selectedCount === 0
}
```

**Layout:**
```
[X of Y creators selected · ~48.2K reach]    [₹32,500 total · 12 posts · 8 stories · 6 reels]    [Launch Campaign →]
```

On mobile, stacks to two rows:
- Row 1: selected count + cost
- Row 2: full-width launch button

**Style:** `backdrop-filter: blur(16px)`, solid dark bg, `border-top: 1px solid var(--border-subtle)`, `z-index: 50`.

### Section 5: Launch Modal (`LaunchModal.svelte`)

Replaces the current slide-over side panel. Opens when "Launch Campaign" is clicked.

**Fields:**
- Campaign title (text input)
- Creative text (textarea) OR file upload hint
- Channel toggles: In-app (default on), Email, WhatsApp (disabled/coming soon)
- Reward per person slider (₹10-500)
- Summary line: "Launching to {N} creators · Est. cost ₹{X}"
- Confirm + Cancel buttons

Calls existing `/api/brand/create-campaign` on confirm.

### Section 6: Empty State

When `users.length === 0` after a search:
- Heading: "No exact matches yet"
- Subtext: "Try broadening your criteria or browse our creator network"
- "Try different criteria" button → returns to intake
- Below: "Browse our network" section fetching from `/api/brand/creators`, displayed in same `CreatorCard` format but without match scores (show archetype + content tags instead)

### Data Flow

```
Portal page (state owner)
  │
  ├── runs search-audience API
  │     ↓ stores: users[], keyTraits[], audienceSize, estimatedCost, etc.
  │
  ├── derives: selectedSet, totalReach, costBreakdown (reactive)
  │
  └── renders ResultsDashboard
        ├── DashboardSummaryBar (reads derived metrics)
        ├── CreatorCard[] (each card reads user + selected state)
        │     └── on expand → calls member-brief API
        ├── AudienceIntelPanel (calls audience-intelligence API)
        └── StickyLaunchBar (reads derived metrics)
              └── on launch → opens LaunchModal
                    └── on confirm → calls create-campaign API
```

Selection state (`selectedSet: Set<string>`) lives in the portal page and is passed down. All cost/reach derivations are reactive statements in the portal page.

### Derived Calculations

```typescript
// All creators selected by default
$: selectedUsers = users.filter(u => selectedSet.has(u.user_google_sub));

// Total reach = sum of follower counts (need to add to search-audience response or use creators endpoint)
// Note: search-audience doesn't return follower_count currently. 
// Either: add follower_count to AudienceSearchUserRow in the API, OR fetch from /api/brand/creators and merge.
// Recommendation: add follower_count to search-audience response (minor API change).

$: totalReach = selectedUsers.reduce((sum, u) => sum + (u.followers ?? 0), 0);

// Cost = sum of post rates for selected (default to post; can add content-type selector later)
$: estimatedCost = selectedUsers.reduce((sum, u) => {
  if (!u.rates?.available) return sum;
  return sum + (u.rates.ig_post_rate_inr ?? 0);
}, 0);

$: costBreakdown = {
  posts: selectedUsers.filter(u => u.rates?.ig_post_rate_inr).length,
  stories: selectedUsers.filter(u => u.rates?.ig_story_rate_inr).length,
  reels: selectedUsers.filter(u => u.rates?.ig_reel_rate_inr).length,
};
```

### API Change Required

**One minor addition to `/api/brand/search-audience`:**

Add `followers` field to `AudienceSearchUserRow`. The data is already queried from `user_profiles` — just not included in the response. Add it to the row mapping.

### Visual Style

- Dark theme, consistent with existing portal
- Glass-morphism cards: `background: var(--glass-light)`, `backdrop-filter: blur(16px)`, `border: 1px solid var(--border-subtle)`
- Summary bar cards: subtle gradient border on hover
- Accent colors: blue (`--accent-secondary`) for primary actions, green for high match, amber for medium
- Sticky bar: solid dark background with blur, elevated with border-top
- Creator cards: existing card style with accent border when selected
- Typography: existing PP Mori font family
- Spacing: 1rem gaps in grid, 24px section padding
- Responsive: 2-col → 1-col at 768px, summary 3-col → 2-col → 1-col

### File Changes Summary

| File | Action |
|------|--------|
| `src/routes/brands/portal/+page.svelte` | Modify results section to use new components, add derived state |
| `src/lib/components/brands/ResultsDashboard.svelte` | Full rewrite as orchestrator |
| `src/lib/components/brands/DashboardSummaryBar.svelte` | New |
| `src/lib/components/brands/CreatorCard.svelte` | New |
| `src/lib/components/brands/AudienceIntelPanel.svelte` | New (extracted from portal) |
| `src/lib/components/brands/StickyLaunchBar.svelte` | New |
| `src/lib/components/brands/LaunchModal.svelte` | New (replaces campaign side panel) |
| `src/routes/api/brand/search-audience/+server.ts` | Add `followers` to response row |

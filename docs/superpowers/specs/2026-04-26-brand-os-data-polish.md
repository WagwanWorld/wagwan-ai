# Brand OS Dashboard — Data Quality & UI Polish

**Date:** 2026-04-26  
**Status:** Approved  
**Goal:** Fix UI bugs (font, double %, Posts/Week), fix data plumbing so existing intelligence surfaces properly, and upgrade the daily brief generator from template strings to an LLM call with a conversational persona.

---

## Problem

The Brand OS dashboard UI layout is correct (12-card bento grid), but:
1. UI bugs: wrong font, double percentage sign, Posts/Week shows dash
2. Data plumbing: the os-dashboard API returns placeholder/fallback text for fields that DO have real data in the `brand_snapshots.intelligence` JSONB column, because field name lookups don't match
3. The daily brief (`generateDailyBrief()`) uses zero LLM — pure template strings like "Detected N insight signals. Prioritize X action first." producing clinical, unreadable output

## Section 1: UI Quick Fixes

**File:** `src/lib/components/brands/BrandOsDashboard.svelte`

### PP Mori Font
Replace hardcoded `'Geist Variable', 'Inter', sans-serif` references with `'PP Mori', 'Geist Variable', 'Inter', sans-serif` for body text, brief headline, and any non-monospace/non-serif text. Labels stay Geist Mono. Numbers stay Bodoni Moda.

### Double % on Eng. Rate
The API returns `"4.19%"` as a string (% included). The component appends `<small>%</small>`. Fix: before rendering, strip trailing `%` from the metric value string. Apply this to any metric whose value already contains `%`.

### Posts/Week Shows Dash
The component calls `metric('Posts/Week')` but the API doesn't include a metric with that label. The value exists in `audience.keyInsights` as "Posts per week". Fix in API (Section 2) by adding it as a 7th executive metric.

### Empty State Copy
Replace clinical fallbacks:

| Current | New |
|---------|-----|
| "Audience signals are still building. Trigger a refresh to generate fresh audience diagnostics." | "We're still getting to know your audience. Run an analysis to unlock insights." |
| "Performance snapshot available, but narrative synthesis has not run yet." | "Your numbers are here — run an analysis to turn them into a story." |
| "Run analysis to generate causal diagnostics." | "We need a deeper look to figure out the why. Hit Run Analysis above." |
| "No personas identified" | "No audience personas yet — they'll appear after your first analysis." |
| "No posts synced yet" | "No Instagram posts synced yet. Run an analysis to pull them in." |

---

## Section 2: Data Plumbing Fixes

**File:** `src/routes/api/brand/os-dashboard/+server.ts`

### Add Posts/Week as 7th Executive Metric
Add after the "Active Campaigns" metric:
```typescript
{
  label: 'Posts/Week',
  value: (latest?.posts_per_week ?? 0).toFixed(1),
  note: Number(latest?.posts_per_week ?? 0) < 2 ? 'Increase recommended' : 'Current pace',
}
```

### Fix recentPosts Fallback Chain
Current: only checks `latestIntel.recentPosts`.  
Add fallback: also check `latestIntel.identity?.recentMedia` and map to the same shape.

### Fix brandVibes Fallback Chain
Current: only checks `latestIntel.identity?.brandVibes`.  
Add fallbacks: `latestIntel.identity?.interests`, `latestIntel.identity?.vibes`.

### Fix Audience Summary Fallback
Current: only checks `audiencePortrait.narrative`.  
Add fallbacks: `audiencePortrait.summary`, `latestIntel.demographics?.narrative`.

### Fix Palette Colors Fallback
Current: checks `brand_identity.visual.colorPalette`.  
Add fallbacks: `latestIntel.identity?.aesthetic?.palette`, `latestIntel.identity?.colorPalette`, `latestIntel.identity?.aesthetic?.colorPalette`.

### Better Content Calendar
When `strategicPositioning.contentPillars` AND `strategicPositioning.quickWins` are both populated, generate calendar entries that combine them:
- `concept` = quick win text (not "Ship one X post with a clear CTA")
- `pillar` = matched content pillar
- Still use `inferCalendar()` as fallback when strategic data is absent

---

## Section 3: LLM-Powered Daily Brief

**Files:**
- `src/lib/server/brand/brandOsEngine.ts` — replace `generateDailyBrief()` internals
- `src/lib/server/prompts/brand-os.ts` — add the brief prompt

### Persona
Friendly strategist with numbers. Conversational warmth + specific data:
> "Your event recaps are pulling 3x the saves of your average post. That's a strong signal — your audience wants to relive the experience. Lean into recap carousels for your next 3 posts."

### Prompt
System prompt sets the persona. User prompt packages:
- Brand name and handle
- Latest metrics: engagement_rate, reach_7d, avg_saves, avg_shares, posts_per_week
- Deltas from previous snapshot
- Top 3 insight_findings (type, title, summary)
- Top 3 content_pillars (label, avg engagement)

### Output Schema
Matches existing `BrandSynopsis` type — no type changes needed:
```typescript
{
  headline: string;       // editorial, max 12 words, no quotes
  whatHappened: string;    // 2-3 sentences, conversational, use "you/your"  
  whyItHappened: string;  // 2-3 sentences, explain the cause
  whatNext: string[];     // 3 items, each starts with a verb, specific
  confidenceLabel: string; // "high" | "medium" | "low"
}
```

### Model
`claude-haiku-4-5-20251001` — same model used by the creator pipeline. ~500 input + ~200 output tokens per call.

### Fallback
If the Claude call fails (network error, rate limit, malformed output), fall back to the existing template-string brief. Log the error but don't crash the cron.

### When It Runs
Inside the existing daily cron at `/api/cron/brand-os-daily`, after `runInsightDetectors()` generates findings. The `generateDailyBrief()` function is already called there — its internals change, its call site doesn't.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/components/brands/BrandOsDashboard.svelte` | PP Mori font, fix double %, fix Posts/Week lookup, warmer empty states |
| `src/routes/api/brand/os-dashboard/+server.ts` | Add Posts/Week metric, fix fallback chains for recentPosts/brandVibes/audience/palette, better content calendar |
| `src/lib/server/brand/brandOsEngine.ts` | Replace template `generateDailyBrief()` with Claude call + fallback |
| `src/lib/server/prompts/brand-os.ts` | Add conversational brief system/user prompt |

## Not Changed

- Intelligence pipeline (`brandIntelligence.ts` Phases 1-8)
- Cron schedule
- Dashboard component layout (BrandOsDashboard.svelte template structure)
- Type definitions (`brand-os.ts`)
- Portal page wiring

## Risk

LLM brief call could fail — mitigated by fallback to existing templates. No breaking changes to any type or API contract.

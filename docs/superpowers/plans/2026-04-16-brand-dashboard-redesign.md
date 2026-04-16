# Brand Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the brand portal results page from placeholder creator cards into a campaign proposal dashboard with 6-metric summary bar, rich creator cards, audience intelligence, and sticky launch bar.

**Architecture:** Decompose the monolithic portal page results section into focused components. Add `followers` field to the search-audience API response. Replace the campaign side panel with a modal. All selection state stays in the portal page and flows down via props.

**Tech Stack:** SvelteKit, TypeScript, Tailwind CSS (utility classes), CSS custom properties (existing design tokens), phosphor-svelte icons.

---

### Task 1: Add `followers` field to search-audience API response

**Files:**
- Modify: `src/lib/server/marketplace/types.ts`
- Modify: `src/routes/api/brand/search-audience/+server.ts`

- [ ] **Step 1: Add `followers` to `AudienceSearchUserRow` type**

In `src/lib/server/marketplace/types.ts`, add the `followers` field to the interface:

```typescript
export interface AudienceSearchUserRow {
  user_google_sub: string;
  name: string;
  city: string;
  match_score: number;
  match_score_breakdown?: {
    interest_match: number;
    behavior_match: number;
    intent_signal: number;
    engagement_probability: number;
  };
  match_reason: string;
  preview_tags: string[];
  followers: number;
  /** 0–100 richer identity_graph improves brand match overlap. */
  graph_strength: number;
  graph_strength_label: GraphStrengthLabel;
}
```

- [ ] **Step 2: Populate `followers` in `scoreUserAgainstAudience`**

In `src/lib/server/marketplace/audienceMatch.ts`, in the `scoreUserAgainstAudience` function, extract the follower count from the identity graph and include it in the return object. Find where the return object is constructed (around line 138-160) and add:

```typescript
const followers = typeof graph.igFollowerCount === 'number'
  ? graph.igFollowerCount
  : typeof graph.followerCount === 'number'
    ? graph.followerCount
    : 0;
```

Add `followers` to the return object alongside `name`, `city`, etc.

- [ ] **Step 3: Verify the field appears in the API response**

Run locally:
```bash
curl -s -X POST http://localhost:5173/api/brand/search-audience \
  -H 'Content-Type: application/json' \
  -d '{"structured":{"interests":["fitness"],"behaviors":[],"age_range":null,"location":null,"human_summary":"test"},"limit":3}' | jq '.users[0] | keys'
```

Expected: `followers` appears in the keys list.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/marketplace/types.ts src/lib/server/marketplace/audienceMatch.ts src/routes/api/brand/search-audience/+server.ts
git commit -m "feat: add followers field to search-audience API response"
```

---

### Task 2: Create `DashboardSummaryBar.svelte`

**Files:**
- Create: `src/lib/components/brands/DashboardSummaryBar.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  export let creatorCount: number;
  export let selectedCount: number;
  export let totalReach: number;
  export let estimatedCost: number | null;
  export let avgMatchScore: number;
  export let keyTraits: { tag: string; count: number }[];
  export let pctHighStrength: number;

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    if (n === 0) return 'Free';
    return '\u20B9' + n.toLocaleString('en-IN');
  }

  $: matchColor = avgMatchScore >= 75 ? 'text-emerald-400' : avgMatchScore >= 50 ? 'text-amber-300' : 'text-zinc-400';
  $: strengthColor = pctHighStrength >= 60 ? 'bg-emerald-500/30' : pctHighStrength >= 30 ? 'bg-amber-500/30' : 'bg-zinc-500/30';
</script>

<div class="summary-grid">
  <div class="summary-card">
    <span class="summary-value">{creatorCount}</span>
    <span class="summary-label">Matched Creators</span>
  </div>
  <div class="summary-card">
    <span class="summary-value">{formatNumber(totalReach)}</span>
    <span class="summary-label">Est. Reach ({selectedCount} selected)</span>
  </div>
  <div class="summary-card">
    <span class="summary-value">
      {#if estimatedCost != null}{formatINR(estimatedCost)}{:else}<span class="text-muted">Set rates</span>{/if}
    </span>
    <span class="summary-label">Campaign Cost</span>
  </div>
  <div class="summary-card">
    <span class="summary-value {matchColor}">{Math.round(avgMatchScore)}%</span>
    <span class="summary-label">Avg Match</span>
  </div>
  <div class="summary-card summary-card--wide">
    <div class="trait-pills">
      {#each keyTraits.slice(0, 5) as t}
        <span class="trait-pill">{t.tag}</span>
      {/each}
    </div>
    <span class="summary-label">Top Signals</span>
  </div>
  <div class="summary-card">
    <div class="strength-row">
      <span class="summary-value">{Math.round(pctHighStrength)}%</span>
      <div class="strength-bar-track">
        <div class="strength-bar-fill {strengthColor}" style="width:{Math.min(100, pctHighStrength)}%"></div>
      </div>
    </div>
    <span class="summary-label">Strong Profiles</span>
  </div>
</div>

<style>
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 768px) {
    .summary-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .summary-grid { grid-template-columns: 1fr; }
  }
  .summary-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    transition: border-color 0.3s;
  }
  .summary-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
  }
  .summary-card--wide {
    grid-column: span 2;
  }
  @media (max-width: 480px) {
    .summary-card--wide { grid-column: span 1; }
  }
  .summary-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
  }
  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .trait-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .trait-pill {
    font-size: 11px;
    background: var(--glass-medium, rgba(255,255,255,0.06));
    border: 1px solid var(--border-subtle);
    border-radius: 9999px;
    padding: 3px 10px;
    color: var(--text-secondary);
  }
  .strength-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .strength-bar-track {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .strength-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .text-muted { color: var(--text-muted); font-size: 14px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/DashboardSummaryBar.svelte
git commit -m "feat: add DashboardSummaryBar component"
```

---

### Task 3: Create `CreatorCard.svelte`

**Files:**
- Create: `src/lib/components/brands/CreatorCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import Note from 'phosphor-svelte/lib/Note';

  type UserRow = {
    user_google_sub: string;
    name: string;
    city: string;
    match_score: number;
    match_score_breakdown?: {
      interest_match: number;
      behavior_match: number;
      intent_signal: number;
      engagement_probability: number;
    };
    match_reason: string;
    preview_tags: string[];
    followers: number;
    graph_strength: number;
    graph_strength_label: string;
    rates?: {
      ig_post_rate_inr?: number;
      ig_story_rate_inr?: number;
      ig_reel_rate_inr?: number;
      available?: boolean;
    };
  };

  type MemberBrief = {
    happening_now: string;
    do_next: string;
    missing: string;
  };

  export let user: UserRow;
  export let selected: boolean = false;
  export let brief: MemberBrief | null = null;
  export let briefLoading: boolean = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    toggle: string;
    loadBrief: string;
  }>();

  let expanded = false;

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function tileGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 38) % 360;
    return `linear-gradient(145deg, hsl(${hue}, 42%, 18%), hsl(${h2}, 36%, 10%))`;
  }

  $: scoreColor = user.match_score >= 75 ? 'score--high' : user.match_score >= 50 ? 'score--mid' : 'score--low';
  $: strengthBadge = user.graph_strength_label === 'high'
    ? 'bg-emerald-500/20 text-emerald-300'
    : user.graph_strength_label === 'medium'
      ? 'bg-amber-500/20 text-amber-200'
      : 'bg-zinc-500/20 text-zinc-400';
</script>

<div
  class="creator-card"
  class:creator-card--selected={selected}
>
  <!-- Checkbox -->
  <button
    type="button"
    class="card-check"
    class:card-check--on={selected}
    on:click|stopPropagation={() => dispatch('toggle', user.user_google_sub)}
    aria-label="{selected ? 'Deselect' : 'Select'} {user.name}"
  >
    {#if selected}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3.5 3.5L13 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </button>

  <!-- Main card body — click to expand -->
  <button
    type="button"
    class="card-body"
    on:click={() => expanded = !expanded}
  >
    <div class="card-top">
      <div class="card-identity">
        <div class="card-avatar" style="background: {tileGradient(user.user_google_sub)}">
          <span>{initials(user.name)}</span>
        </div>
        <div class="card-name-block">
          <span class="card-name">{user.name}</span>
          <span class="card-location">{user.city || 'Unknown'}</span>
        </div>
      </div>
      <span class="card-followers">{formatNumber(user.followers || 0)}</span>
    </div>

    <div class="card-badges">
      <span class="card-score {scoreColor}">{Math.round(user.match_score)}% match</span>
      <span class="card-strength {strengthBadge}">
        {user.graph_strength}
      </span>
    </div>

    <!-- Rates -->
    <div class="card-rates">
      {#if user.rates?.available}
        {#if user.rates.ig_post_rate_inr}<span class="rate-item">Post \u20B9{user.rates.ig_post_rate_inr?.toLocaleString('en-IN')}</span>{/if}
        {#if user.rates.ig_story_rate_inr}<span class="rate-item">Story \u20B9{user.rates.ig_story_rate_inr?.toLocaleString('en-IN')}</span>{/if}
        {#if user.rates.ig_reel_rate_inr}<span class="rate-item">Reel \u20B9{user.rates.ig_reel_rate_inr?.toLocaleString('en-IN')}</span>{/if}
      {:else}
        <span class="rate-item rate-item--na">Rates not set</span>
      {/if}
    </div>

    <!-- Tags -->
    <div class="card-tags">
      {#each user.preview_tags.slice(0, 5) as tag}
        <span class="tag">{tag}</span>
      {/each}
    </div>

    <!-- Match reason -->
    <p class="card-reason">{user.match_reason}</p>
  </button>

  <!-- Expanded: breakdown + brief -->
  {#if expanded}
    <div class="card-expanded">
      {#if user.match_score_breakdown}
        <div class="breakdown">
          <p class="breakdown-title">Match breakdown</p>
          {#each [
            { label: 'Interest', value: user.match_score_breakdown.interest_match },
            { label: 'Behavior', value: user.match_score_breakdown.behavior_match },
            { label: 'Intent', value: user.match_score_breakdown.intent_signal },
            { label: 'Engagement', value: user.match_score_breakdown.engagement_probability },
          ] as item}
            <div class="breakdown-row">
              <span class="breakdown-label">{item.label}</span>
              <div class="breakdown-bar-track">
                <div class="breakdown-bar-fill" style="width:{Math.min(100, item.value * 100)}%"></div>
              </div>
              <span class="breakdown-val">{Math.round(item.value * 100)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="brief-section">
        {#if brief}
          <div class="brief-body">
            <p><span class="brief-label">Now:</span> {brief.happening_now}</p>
            <p><span class="brief-label">Next:</span> {brief.do_next}</p>
            <p><span class="brief-label">Missing:</span> {brief.missing}</p>
          </div>
        {:else}
          <button
            type="button"
            class="brief-btn"
            disabled={briefLoading}
            on:click|stopPropagation={() => dispatch('loadBrief', user.user_google_sub)}
          >
            <Note size={14} />
            {briefLoading ? 'Loading...' : 'Generate brief'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .creator-card {
    position: relative;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.3s, background 0.3s, transform 0.3s;
    overflow: hidden;
  }
  .creator-card:hover {
    border-color: rgba(77, 124, 255, 0.25);
    background: var(--glass-medium, rgba(255,255,255,0.04));
  }
  .creator-card--selected {
    border-color: var(--accent-secondary, #4D7CFF);
    box-shadow: 0 0 0 1px rgba(77, 124, 255, 0.15);
  }

  .card-check {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1.5px solid var(--border-strong, rgba(255,255,255,0.15));
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    transition: background 0.15s, border-color 0.15s;
    padding: 0;
    color: white;
  }
  .card-check--on {
    background: var(--accent-secondary, #4D7CFF);
    border-color: var(--accent-secondary, #4D7CFF);
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    padding-right: 44px;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .card-identity {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .card-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }
  .card-name-block {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .card-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-location {
    font-size: 11px;
    color: var(--text-muted);
  }
  .card-followers {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .card-badges {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-score {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 8px;
  }
  .score--high { color: #6ee7b7; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.25); }
  .score--mid  { color: #fcd34d; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.2); }
  .score--low  { color: #a1a1aa; background: rgba(161, 161, 170, 0.1); border: 1px solid rgba(161, 161, 170, 0.15); }

  .card-strength {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .card-rates {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .rate-item {
    font-size: 11px;
    color: var(--text-secondary);
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
  }
  .rate-item--na {
    color: var(--text-muted);
    font-style: italic;
    background: none;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag {
    font-size: 11px;
    background: var(--glass-medium, rgba(255,255,255,0.06));
    border-radius: 6px;
    padding: 2px 8px;
    color: var(--text-muted);
  }

  .card-reason {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.45;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Expanded section */
  .card-expanded {
    padding: 0 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-top: 1px solid var(--border-subtle);
    padding-top: 14px;
    margin-top: 4px;
  }

  .breakdown-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 8px;
  }
  .breakdown-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .breakdown-label {
    font-size: 11px;
    color: var(--text-secondary);
    width: 72px;
    flex-shrink: 0;
  }
  .breakdown-bar-track {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .breakdown-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--accent-secondary, #4D7CFF);
    transition: width 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .breakdown-val {
    font-size: 11px;
    color: var(--text-muted);
    width: 24px;
    text-align: right;
  }

  .brief-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    color: var(--accent-tertiary, #FFB84D);
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .brief-btn:hover { border-color: var(--accent-tertiary, #FFB84D); background: rgba(255, 184, 77, 0.06); }
  .brief-btn:disabled { opacity: 0.5; cursor: default; }

  .brief-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .brief-body p { margin: 0; }
  .brief-label {
    font-weight: 600;
    color: var(--text-primary);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/CreatorCard.svelte
git commit -m "feat: add CreatorCard component with expandable breakdown and brief"
```

---

### Task 4: Create `StickyLaunchBar.svelte`

**Files:**
- Create: `src/lib/components/brands/StickyLaunchBar.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  export let selectedCount: number;
  export let totalCount: number;
  export let totalReach: number;
  export let estimatedCost: number | null;
  export let costBreakdown: { posts: number; stories: number; reels: number };
  export let disabled: boolean = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ launch: void; startOver: void }>();

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    return '\u20B9' + n.toLocaleString('en-IN');
  }

  $: breakdownText = [
    costBreakdown.posts > 0 ? `${costBreakdown.posts} posts` : '',
    costBreakdown.stories > 0 ? `${costBreakdown.stories} stories` : '',
    costBreakdown.reels > 0 ? `${costBreakdown.reels} reels` : '',
  ].filter(Boolean).join(' \u00B7 ');
</script>

<div class="launch-bar">
  <div class="bar-inner">
    <div class="bar-left">
      <span class="bar-count">{selectedCount} of {totalCount}</span>
      <span class="bar-sep">\u00B7</span>
      <span class="bar-reach">~{formatNumber(totalReach)} reach</span>
    </div>

    <div class="bar-center">
      {#if estimatedCost != null && estimatedCost > 0}
        <span class="bar-cost">{formatINR(estimatedCost)}</span>
        {#if breakdownText}
          <span class="bar-breakdown">{breakdownText}</span>
        {/if}
      {:else}
        <span class="bar-cost bar-cost--muted">Cost TBD</span>
      {/if}
    </div>

    <div class="bar-right">
      <button type="button" class="bar-secondary" on:click={() => dispatch('startOver')}>
        Start over
      </button>
      <button
        type="button"
        class="bar-launch"
        disabled={disabled || selectedCount === 0}
        on:click={() => dispatch('launch')}
      >
        Launch Campaign
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .launch-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(10, 10, 12, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border-subtle);
    padding: 12px 24px;
    animation: bar-enter 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes bar-enter {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .bar-inner {
    max-width: 72rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .bar-left, .bar-center {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .bar-count {
    font-weight: 600;
    color: var(--text-primary);
  }
  .bar-sep { color: var(--text-muted); }
  .bar-reach { color: var(--text-muted); }

  .bar-cost {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
  }
  .bar-cost--muted {
    color: var(--text-muted);
    font-weight: 500;
  }
  .bar-breakdown {
    font-size: 11px;
    color: var(--text-muted);
  }

  .bar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .bar-secondary {
    background: none;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }
  .bar-secondary:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }
  .bar-launch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D));
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
  }
  .bar-launch:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .bar-launch:active:not(:disabled) { transform: scale(0.98); }
  .bar-launch:disabled { opacity: 0.35; cursor: default; }

  @media (max-width: 768px) {
    .bar-inner { flex-wrap: wrap; gap: 10px; }
    .bar-center { display: none; }
    .bar-right { width: 100%; }
    .bar-launch { flex: 1; justify-content: center; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/StickyLaunchBar.svelte
git commit -m "feat: add StickyLaunchBar component"
```

---

### Task 5: Create `LaunchModal.svelte`

**Files:**
- Create: `src/lib/components/brands/LaunchModal.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import X from 'phosphor-svelte/lib/X';
  import { createEventDispatcher } from 'svelte';

  export let selectedCount: number;
  export let estimatedCost: number | null;
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    confirm: {
      title: string;
      creativeText: string;
      rewardInr: number;
      channels: { email: boolean; in_app: boolean; whatsapp: boolean };
    };
    close: void;
  }>();

  let title = '';
  let creativeText = '';
  let rewardInr = 50;
  let channelEmail = false;
  let channelInApp = true;
  let submitting = false;
  let errorMsg = '';

  function handleSubmit() {
    errorMsg = '';
    if (!title.trim()) { errorMsg = 'Name this campaign.'; return; }
    submitting = true;
    dispatch('confirm', {
      title: title.trim(),
      creativeText: creativeText.trim(),
      rewardInr,
      channels: { email: channelEmail, in_app: channelInApp, whatsapp: false },
    });
  }

  function formatINR(n: number): string {
    return '\u20B9' + n.toLocaleString('en-IN');
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="modal-backdrop" on:click={() => dispatch('close')} role="presentation">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-card" on:click|stopPropagation role="dialog" aria-label="Launch campaign">
    <div class="modal-header">
      <h3 class="modal-title">Launch Campaign</h3>
      <button type="button" class="modal-close" on:click={() => dispatch('close')} aria-label="Close">
        <X size={18} />
      </button>
    </div>

    <form class="modal-body" on:submit|preventDefault={handleSubmit}>
      <div class="field">
        <label for="campaign-title">Campaign name</label>
        <input id="campaign-title" type="text" bind:value={title} placeholder="e.g. Summer Drop Promo" />
      </div>

      <div class="field">
        <label for="creative-text">Creative brief</label>
        <textarea id="creative-text" bind:value={creativeText} placeholder="What should creators know about this campaign?" rows="3"></textarea>
      </div>

      <div class="field">
        <label for="reward-slider">Reward per person: {formatINR(rewardInr)}</label>
        <input id="reward-slider" type="range" min="10" max="500" step="10" bind:value={rewardInr} />
        <div class="range-labels">
          <span>\u20B910</span><span>\u20B9500</span>
        </div>
      </div>

      <div class="field">
        <label>Channels</label>
        <div class="channel-row">
          <label class="channel-toggle">
            <input type="checkbox" bind:checked={channelInApp} />
            <span>In-app</span>
          </label>
          <label class="channel-toggle">
            <input type="checkbox" bind:checked={channelEmail} />
            <span>Email</span>
          </label>
          <label class="channel-toggle channel-toggle--disabled">
            <input type="checkbox" disabled />
            <span>WhatsApp <em>(soon)</em></span>
          </label>
        </div>
      </div>

      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}

      <div class="modal-footer">
        <p class="footer-summary">
          Launching to <strong>{selectedCount}</strong> creators
          {#if estimatedCost != null} &middot; Est. {formatINR(estimatedCost)}{/if}
        </p>
        <button type="submit" class="confirm-btn" disabled={submitting}>
          {submitting ? 'Launching...' : 'Confirm & Launch'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fade-in 0.2s ease-out;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .modal-card {
    width: 100%;
    max-width: 480px;
    background: var(--bg-elevated, #1a1a1e);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    overflow: hidden;
    animation: modal-enter 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes modal-enter {
    from { opacity: 0; transform: scale(0.95) translateY(12px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s;
  }
  .modal-close:hover { color: var(--text-primary); }

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .field input[type="text"],
  .field textarea {
    background: var(--bg-primary, #0a0a0c);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }
  .field input[type="text"]:focus,
  .field textarea:focus {
    border-color: rgba(77, 124, 255, 0.4);
  }
  .field textarea { resize: vertical; min-height: 56px; line-height: 1.5; }
  .field input[type="text"]::placeholder,
  .field textarea::placeholder { color: var(--text-muted); }

  .field input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
    outline: none;
  }
  .field input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-secondary, #4D7CFF);
    cursor: pointer;
  }
  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
  }

  .channel-row {
    display: flex;
    gap: 16px;
  }
  .channel-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .channel-toggle--disabled {
    opacity: 0.4;
    cursor: default;
  }
  .channel-toggle em {
    font-size: 10px;
    color: var(--text-muted);
  }

  .error-msg {
    font-size: 13px;
    color: #f87171;
    margin: 0;
  }

  .modal-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .footer-summary {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    text-align: center;
  }
  .footer-summary strong {
    color: var(--text-primary);
  }
  .confirm-btn {
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D));
    color: white;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s;
  }
  .confirm-btn:hover:not(:disabled) { opacity: 0.92; }
  .confirm-btn:active:not(:disabled) { transform: scale(0.98); }
  .confirm-btn:disabled { opacity: 0.4; cursor: default; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/LaunchModal.svelte
git commit -m "feat: add LaunchModal component for campaign launch"
```

---

### Task 6: Rewrite `ResultsDashboard.svelte`

**Files:**
- Modify: `src/lib/components/brands/ResultsDashboard.svelte`

The existing ResultsDashboard is used by the **guided agent flow** (step machine: intake → questions → thinking → results). It receives `matches` which are `MatchedCreator[]` from the match-agent SSE pipeline. We rewrite it to use the new sub-components and show the rich dashboard.

- [ ] **Step 1: Rewrite the component**

Replace the entire file content with the new dashboard that uses `DashboardSummaryBar`, `CreatorCard`, and `StickyLaunchBar`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import DashboardSummaryBar from './DashboardSummaryBar.svelte';
  import CreatorCard from './CreatorCard.svelte';
  import StickyLaunchBar from './StickyLaunchBar.svelte';
  import LaunchModal from './LaunchModal.svelte';

  type MatchedCreator = {
    creator: {
      google_sub: string;
      name: string;
      handle: string;
      follower_count: number;
      content_themes: string[];
      location: string;
      rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
      graph_strength: number;
    };
    score: number;
    reasoning: string;
    watch_out: string;
  };

  export let matches: MatchedCreator[] = [];
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    startCampaign: { selected: string[]; title: string; creativeText: string; rewardInr: number; channels: { email: boolean; in_app: boolean; whatsapp: boolean } };
    startOver: void;
  }>();

  // Convert matches to the user row format expected by CreatorCard
  $: users = matches.map(m => ({
    user_google_sub: m.creator.google_sub,
    name: m.creator.name,
    city: m.creator.location,
    match_score: m.score,
    match_score_breakdown: undefined as undefined,
    match_reason: m.reasoning,
    preview_tags: m.creator.content_themes.slice(0, 5),
    followers: m.creator.follower_count,
    graph_strength: m.creator.graph_strength,
    graph_strength_label: m.creator.graph_strength >= 65 ? 'high' : m.creator.graph_strength >= 35 ? 'medium' : 'low',
    rates: m.creator.rates ? {
      ig_post_rate_inr: m.creator.rates.ig_post_rate_inr,
      ig_story_rate_inr: m.creator.rates.ig_story_rate_inr,
      ig_reel_rate_inr: m.creator.rates.ig_reel_rate_inr,
      available: m.creator.rates.available,
    } : undefined,
  }));

  // All selected by default
  let selected = new Set<string>(matches.map(m => m.creator.google_sub));

  $: selectedUsers = users.filter(u => selected.has(u.user_google_sub));
  $: totalReach = selectedUsers.reduce((s, u) => s + (u.followers || 0), 0);
  $: estimatedCost = selectedUsers.reduce((s, u) => s + (u.rates?.ig_post_rate_inr ?? 0), 0) || null;
  $: avgMatchScore = users.length ? users.reduce((s, u) => s + u.match_score, 0) / users.length : 0;
  $: pctHighStrength = users.length
    ? Math.round(users.filter(u => u.graph_strength >= 65).length / users.length * 100)
    : 0;

  // Key traits from content themes
  $: keyTraits = (() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      for (const t of u.preview_tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  })();

  $: costBreakdown = {
    posts: selectedUsers.filter(u => u.rates?.ig_post_rate_inr).length,
    stories: selectedUsers.filter(u => u.rates?.ig_story_rate_inr).length,
    reels: selectedUsers.filter(u => u.rates?.ig_reel_rate_inr).length,
  };

  let showLaunchModal = false;

  // Member briefs
  let memberBriefBySub: Record<string, { happening_now: string; do_next: string; missing: string }> = {};
  let memberBriefLoading: string | null = null;

  function toggleCreator(e: CustomEvent<string>) {
    const sub = e.detail;
    const next = new Set(selected);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);
    selected = next;
  }

  async function loadBrief(e: CustomEvent<string>) {
    const sub = e.detail;
    const user = users.find(u => u.user_google_sub === sub);
    if (!user) return;
    memberBriefLoading = sub;
    try {
      const res = await fetch('/api/brand/member-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_google_sub: sub, match_reason: user.match_reason }),
      });
      const j = await res.json();
      if (j.ok && j.brief) {
        memberBriefBySub = { ...memberBriefBySub, [sub]: j.brief };
      }
    } catch { /* ignore */ }
    finally { memberBriefLoading = null; }
  }

  function handleLaunchConfirm(e: CustomEvent<{ title: string; creativeText: string; rewardInr: number; channels: { email: boolean; in_app: boolean; whatsapp: boolean } }>) {
    showLaunchModal = false;
    dispatch('startCampaign', {
      selected: [...selected],
      ...e.detail,
    });
  }
</script>

<div class="dashboard-root">
  {#if matches.length === 0}
    <div class="empty-state">
      <h3 class="empty-title">No exact matches yet</h3>
      <p class="empty-text">Try broadening your criteria or adjusting your audience description.</p>
      <button class="empty-btn" on:click={() => dispatch('startOver')}>Try different criteria</button>
    </div>
  {:else}
    <DashboardSummaryBar
      creatorCount={users.length}
      selectedCount={selected.size}
      {totalReach}
      {estimatedCost}
      {avgMatchScore}
      {keyTraits}
      {pctHighStrength}
    />

    <div class="section-header">
      <h3 class="section-title">Your creators</h3>
      <p class="section-meta">{selected.size} selected &middot; click to expand, checkbox to select</p>
    </div>

    <div class="creator-grid">
      {#each users as user (user.user_google_sub)}
        <CreatorCard
          {user}
          selected={selected.has(user.user_google_sub)}
          brief={memberBriefBySub[user.user_google_sub] ?? null}
          briefLoading={memberBriefLoading === user.user_google_sub}
          on:toggle={toggleCreator}
          on:loadBrief={loadBrief}
        />
      {/each}
    </div>

    <StickyLaunchBar
      selectedCount={selected.size}
      totalCount={users.length}
      {totalReach}
      {estimatedCost}
      {costBreakdown}
      on:launch={() => showLaunchModal = true}
      on:startOver={() => dispatch('startOver')}
    />

    {#if showLaunchModal}
      <LaunchModal
        selectedCount={selected.size}
        {estimatedCost}
        {brandName}
        on:confirm={handleLaunchConfirm}
        on:close={() => showLaunchModal = false}
      />
    {/if}
  {/if}
</div>

<style>
  .dashboard-root {
    max-width: 72rem;
    margin: 0 auto;
    padding: 32px 24px 120px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .section-meta {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .creator-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 768px) {
    .creator-grid { grid-template-columns: 1fr; }
  }

  .empty-state {
    text-align: center;
    padding: 60px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .empty-text {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
    max-width: 400px;
    line-height: 1.5;
  }
  .empty-btn {
    margin-top: 8px;
    background: var(--accent-secondary, #4D7CFF);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .empty-btn:hover { opacity: 0.9; }
</style>
```

- [ ] **Step 2: Update the portal page to pass campaign data back**

In `src/routes/brands/portal/+page.svelte`, find where ResultsDashboard dispatches `startCampaign`. The current handler in the portal page (around line 204 in the template) only receives `{ selected: string[] }`. Update the handler to also handle the new fields from the launch modal. Find the `on:startCampaign` handler and update it to call `createCampaign` with the modal data:

Find the ResultsDashboard usage in the template (search for `<ResultsDashboard`). It should look like:
```svelte
<ResultsDashboard
  matches={matchResults}
  brandName={brandName}
  on:startCampaign={...}
  on:startOver={handleStartOver}
/>
```

Update the `on:startCampaign` handler to use the new payload shape. The portal page's `createCampaign` function already handles the API call — wire the modal data into it:

```svelte
on:startCampaign={(e) => {
  const d = e.detail;
  campaignTitle = d.title;
  creativeText = d.creativeText;
  rewardInr = d.rewardInr;
  channelEmail = d.channels.email;
  channelInApp = d.channels.in_app;
  selected = new Set(d.selected);
  createCampaign();
}}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/ResultsDashboard.svelte src/routes/brands/portal/+page.svelte
git commit -m "feat: rewrite ResultsDashboard as campaign proposal dashboard"
```

---

### Task 7: Update manual search results in portal page

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

The manual search flow in the portal page (lines ~760-1090) renders results inline with its own member cards, overview panel, mosaic, etc. Replace this section with the same components used by ResultsDashboard.

- [ ] **Step 1: Add `followers` to the manual search user type**

In `src/routes/brands/portal/+page.svelte`, update the `users` type definition (around line 187) to include `followers`:

```typescript
let users: Array<{
  user_google_sub: string;
  name: string;
  city: string;
  match_score: number;
  match_score_breakdown?: {
    interest_match: number;
    behavior_match: number;
    intent_signal: number;
    engagement_probability: number;
  };
  match_reason: string;
  preview_tags: string[];
  followers: number;
  graph_strength: number;
  graph_strength_label: string;
  rates?: {
    ig_post_rate_inr?: number;
    ig_story_rate_inr?: number;
    ig_reel_rate_inr?: number;
    available?: boolean;
  };
}> = [];
```

- [ ] **Step 2: Add derived reactive state for the summary bar and sticky bar**

After the existing `$: insightCards` reactive block (around line 298), add:

```typescript
$: manualSelectedUsers = users.filter(u => selected.has(u.user_google_sub));
$: manualTotalReach = manualSelectedUsers.reduce((s, u) => s + (u.followers || 0), 0);
$: manualEstimatedCost = manualSelectedUsers.reduce((s, u) => s + (u.rates?.ig_post_rate_inr ?? 0), 0) || null;
$: manualAvgMatchScore = users.length ? users.reduce((s, u) => s + u.match_score, 0) / users.length : 0;
$: manualCostBreakdown = {
  posts: manualSelectedUsers.filter(u => u.rates?.ig_post_rate_inr).length,
  stories: manualSelectedUsers.filter(u => u.rates?.ig_story_rate_inr).length,
  reels: manualSelectedUsers.filter(u => u.rates?.ig_reel_rate_inr).length,
};
```

- [ ] **Step 3: Add component imports**

At the top of the script section, add imports for the new components:

```typescript
import DashboardSummaryBar from '$lib/components/brands/DashboardSummaryBar.svelte';
import CreatorCard from '$lib/components/brands/CreatorCard.svelte';
import StickyLaunchBar from '$lib/components/brands/StickyLaunchBar.svelte';
import LaunchModal from '$lib/components/brands/LaunchModal.svelte';
```

- [ ] **Step 4: Replace the results template section**

Replace the results section (from the `<!-- Overview + mosaic -->` comment through the end of the member deck section, roughly lines 846-1086) with:

```svelte
        <!-- Dashboard summary -->
        <DashboardSummaryBar
          creatorCount={users.length}
          selectedCount={selected.size}
          totalReach={manualTotalReach}
          estimatedCost={manualEstimatedCost}
          avgMatchScore={manualAvgMatchScore}
          {keyTraits}
          {pctHighStrength}
        />

        <!-- Audience intelligence -->
        {#if users.length > 0}
          <div class="audience-intel-panel rounded-2xl p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="intel-label text-[11px] font-semibold uppercase tracking-wider">Audience intelligence</p>
                <p class="text-secondary mt-2 max-w-xl text-sm">
                  Monetization read — goals, friction, converting content. Uses selected rows if any, otherwise top 24.
                </p>
              </div>
              <button
                type="button"
                disabled={audienceIntelLoading}
                class="generate-intel-btn shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-opacity disabled:opacity-50"
                on:click={() => runAudienceIntelligence()}
              >
                {audienceIntelLoading ? 'Generating\u2026' : 'Generate'}
              </button>
            </div>
            {#if audienceIntelErr}
              <p class="mt-3 text-sm text-red-400/90">{audienceIntelErr}</p>
            {/if}
            {#if audienceIntelMembersUsed != null && audienceIntel}
              <p class="text-muted mt-2 text-xs">Based on {audienceIntelMembersUsed} profiles.</p>
            {/if}
            {#if audienceIntel}
              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Trying to achieve</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.trying_to_achieve}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Struggling with</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.struggling_with}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Content that converts</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.content_that_converts}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Will pay for</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.will_pay_for}</p>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Creator cards -->
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-muted text-sm">
              <span class="text-primary">{selected.size}</span> selected &middot; click to expand, checkbox to select
            </p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => selectTop(10)}>Top 10</button>
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => selectTop(25)}>Top 25</button>
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => { selected = new Set(users.map(u => u.user_google_sub)); }}>All</button>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            {#each users as u (u.user_google_sub)}
              <CreatorCard
                user={u}
                selected={selected.has(u.user_google_sub)}
                brief={memberBriefBySub[u.user_google_sub] ?? null}
                briefLoading={memberBriefLoading === u.user_google_sub}
                on:toggle={(e) => toggleRow(e.detail)}
                on:loadBrief={(e) => loadMemberBrief(users.find(x => x.user_google_sub === e.detail))}
              />
            {/each}
          </div>
        </div>
```

- [ ] **Step 5: Replace the campaign side panel with StickyLaunchBar + LaunchModal**

Remove the entire campaign slide-over section (lines ~1091-1190, starting with `{#if campaignPanelOpen}` through its closing tags). Replace with:

After the closing `{/if}` of `{#if inResultsMode}`, add:

```svelte
    {#if inResultsMode && users.length > 0}
      <StickyLaunchBar
        selectedCount={selected.size}
        totalCount={users.length}
        totalReach={manualTotalReach}
        estimatedCost={manualEstimatedCost}
        costBreakdown={manualCostBreakdown}
        on:launch={() => campaignPanelOpen = true}
        on:startOver={confirmNewScene}
      />
    {/if}

    {#if campaignPanelOpen}
      <LaunchModal
        selectedCount={selected.size}
        estimatedCost={manualEstimatedCost}
        {brandName}
        on:confirm={(e) => {
          const d = e.detail;
          campaignTitle = d.title;
          creativeText = d.creativeText;
          rewardInr = d.rewardInr;
          channelEmail = d.channels.email;
          channelInApp = d.channels.in_app;
          createCampaign();
        }}
        on:close={() => campaignPanelOpen = false}
      />
    {/if}
```

- [ ] **Step 6: Remove old overview panel, mosaic, insight cards, and member card sections**

Delete the following template sections that are now replaced:
- The "Overview + mosaic" `<div class="grid gap-6 lg:grid-cols-12">` block (old lines ~846-910)
- The "Insight floats" section (old lines ~912-925)
- The rank strength boost paragraph (old lines ~927-929)
- The old member deck with inline member cards (old lines ~983-1086)
- The old campaign slide-over panel (old lines ~1091-1190)

Keep the "Top bar" section (lines ~806-844) with the audience heading, export button, and sign out — but remove the "Launch campaign" button from it since StickyLaunchBar handles that now.

- [ ] **Step 7: Remove unused variables and helper functions**

Clean up from the script section:
- Remove `insightCards` reactive declaration (no longer used)
- Remove the `tileGradient` function (now in CreatorCard)
- Remove the `initials` function (now in CreatorCard)
- Remove `dropActive`, `creativeDropHint`, `onCreativeDrop`, `onCreativeFilePick`, `readCreativeFile` (file upload was in old slide-over, now handled in LaunchModal if needed later)

- [ ] **Step 8: Build and verify**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat: integrate dashboard components into manual search flow"
```

---

### Task 8: Add `followers` to audienceMatch return

**Files:**
- Modify: `src/lib/server/marketplace/audienceMatch.ts`

- [ ] **Step 1: Read the scoreUserAgainstAudience function to find the return object**

Read lines 70-170 of `src/lib/server/marketplace/audienceMatch.ts` to find where the return object is constructed.

- [ ] **Step 2: Extract follower count and add to return**

In `scoreUserAgainstAudience`, before the return statement, add:

```typescript
const followers = typeof graph.igFollowerCount === 'number'
  ? graph.igFollowerCount
  : typeof graph.followerCount === 'number'
    ? graph.followerCount
    : typeof graph.igFollowers === 'number'
      ? graph.igFollowers
      : 0;
```

Add `followers` to the return object.

- [ ] **Step 3: Build and verify**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/marketplace/audienceMatch.ts
git commit -m "feat: extract followers from identity graph in audience matcher"
```

---

### Task 9: Final build, test, and deploy

- [ ] **Step 1: Full build**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Start dev server and test**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run dev
```

Open `http://localhost:5173/brands/portal` in browser. Verify:
1. Intake form renders (no overflow on Instagram field)
2. After submitting a prompt in manual search, the new dashboard renders with:
   - 6-card summary bar
   - Creator cards with rates, tags, match badges, graph strength
   - Clicking a card expands to show breakdown + brief button
   - Checkbox toggles selection
   - Summary bar updates reactively
   - Sticky launch bar at bottom with running totals
   - Launch button opens modal
3. Empty state shows "No exact matches" message

- [ ] **Step 3: Push and deploy**

```bash
git push origin master
```

Verify deployment succeeds on Vercel.

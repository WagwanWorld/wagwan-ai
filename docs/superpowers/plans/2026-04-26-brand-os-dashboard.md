# Brand OS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6 broken `BrandPortal*` components with a single `BrandOsDashboard.svelte` that renders a 12-card conversational bento dashboard with sparklines, Instagram thumbnails, color palette swatches, and the dark OS aesthetic.

**Architecture:** Single component receives `BrandOsDashboard` data, renders all cards inline with scoped styles. API endpoint extended to include `recentPosts` and `brandVibes`. No sub-component delegation — everything in one file for style consistency.

**Tech Stack:** SvelteKit, TypeScript, CSS (scoped, hardcoded OS tokens), inline SVG for sparklines/ring.

**Spec:** `docs/superpowers/specs/2026-04-25-brand-os-dashboard-redesign.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/components/brands/BrandOsDashboard.svelte` | CREATE | Single dashboard component — all 12 bento cards, scoped styles |
| `src/lib/types/brand-os.ts` | MODIFY | Add `recentPosts` and `brandVibes` to type |
| `src/routes/api/brand/os-dashboard/+server.ts` | MODIFY | Add `recentPosts` and `brandVibes` to API response |
| `src/routes/brands/portal/+page.svelte` | MODIFY | Replace 6 component imports + calls with single `<BrandOsDashboard>` |

---

### Task 1: Extend BrandOsDashboard type with recentPosts and brandVibes

**Files:**
- Modify: `src/lib/types/brand-os.ts`

- [ ] **Step 1: Add RecentPost interface and extend BrandOsDashboard**

In `src/lib/types/brand-os.ts`, add before the `BrandOsDashboard` interface:

```typescript
export interface RecentPost {
  id: string;
  thumbnail: string;
  type: string;
  likes: number;
  comments: number;
  permalink: string;
}
```

Then add two fields to the `BrandOsDashboard` interface, after `contentOps`:

```typescript
  recentPosts: RecentPost[];
  brandVibes: string[];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/brand-os.ts
git commit -m "feat(types): add recentPosts and brandVibes to BrandOsDashboard"
```

---

### Task 2: Extend os-dashboard API to return recentPosts and brandVibes

**Files:**
- Modify: `src/routes/api/brand/os-dashboard/+server.ts`

- [ ] **Step 1: Extract recentPosts and brandVibes from snapshot intelligence**

In the API handler, after line ~107 where `latestIntel` is defined, add:

```typescript
const recentPosts = (Array.isArray(latestIntel.recentPosts) ? latestIntel.recentPosts : []).slice(0, 8).map((p: any) => ({
  id: String(p.id || ''),
  thumbnail: String(p.thumbnail || ''),
  type: String(p.type || 'IMAGE'),
  likes: Number(p.likes ?? 0),
  comments: Number(p.comments ?? 0),
  permalink: String(p.permalink || ''),
}));

const brandVibes: string[] = Array.isArray(latestIntel.identity?.brandVibes)
  ? latestIntel.identity.brandVibes.slice(0, 6)
  : [];
```

- [ ] **Step 2: Add the new fields to the dashboard response object**

In the `dashboard` object (around line 289, before the closing `}`), add:

```typescript
    recentPosts,
    brandVibes,
```

- [ ] **Step 3: Build check**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds (✓ done)

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/brand/os-dashboard/+server.ts
git commit -m "feat(api): add recentPosts and brandVibes to os-dashboard response"
```

---

### Task 3: Create BrandOsDashboard.svelte — Row 1 (Brief + Health) and Row 2-3 (Metrics)

**Files:**
- Create: `src/lib/components/brands/BrandOsDashboard.svelte`

- [ ] **Step 1: Create the component with script, first 3 rows of cards, and styles**

Create `src/lib/components/brands/BrandOsDashboard.svelte`. The full component is large, so this task builds the top section. The component should:

**Script section:**
```typescript
<script lang="ts">
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let dashboard: BrandOsDashboard;
  export let syncing: boolean = false;
  export let onRefresh: () => void = () => {};
  export let onRegenerateSynopsis: () => void = () => {};
  export let onRegenerateBrandKit: () => void = () => {};

  // Destructure for convenience
  $: exec = dashboard.executive;
  $: synopsis = dashboard.synopsis;
  $: audience = dashboard.audienceInsights;
  $: kit = dashboard.brandKit;
  $: campOps = dashboard.campaignOps;
  $: contentOps = dashboard.contentOps;
  $: posts = dashboard.recentPosts ?? [];
  $: vibes = dashboard.brandVibes ?? [];

  // Find specific metrics by label
  function metric(label: string) {
    return exec.metrics.find(m => m.label === label);
  }

  // Brand health score (composite 0-100)
  $: healthScore = (() => {
    const eng = parseFloat(metric('Engagement Rate')?.value || '0');
    const reach = parseFloat(metric('Reach (7d)')?.value?.replace(/,/g, '') || '0');
    const saves = parseFloat(metric('Save Rate Proxy')?.value || '0');
    const postsWk = parseFloat(audience.keyInsights.find(k => k.title === 'Posts per week')?.value || '0');
    let score = 0;
    score += Math.min(eng * 10, 30);       // engagement up to 30
    score += Math.min(reach / 10, 20);      // reach up to 20
    score += Math.min(saves * 10, 20);      // saves up to 20
    score += Math.min(postsWk * 10, 15);    // posting frequency up to 15
    score += vibes.length > 0 ? 5 : 0;      // identity completeness
    score += audience.personas.length > 0 ? 10 : 0; // audience depth
    return Math.min(Math.round(score), 100);
  })();

  $: healthLabel = healthScore >= 70 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Low';
  $: healthColor = healthScore >= 70 ? '#4ade80' : healthScore >= 40 ? '#E8833A' : '#f87171';

  // SVG ring math
  $: ringCircumference = 2 * Math.PI * 32; // radius 32
  $: ringOffset = ringCircumference - (healthScore / 100) * ringCircumference;

  // Parse palette colors from string
  $: paletteColors = (() => {
    const raw = kit.visualDirection.palette;
    if (!raw || raw.includes('Need refreshed')) return ['#E8833A', '#1a1a2e', '#E87FA8', '#EDEDEF'];
    const hexMatches = raw.match(/#[0-9a-fA-F]{3,8}/g);
    if (hexMatches?.length) return hexMatches.slice(0, 4);
    return raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
  })();

  // Sparkline bars (synthetic from single value + trend)
  function sparkBars(value: number, trend: 'up' | 'down' | 'flat'): number[] {
    const bars = [];
    for (let i = 0; i < 7; i++) {
      const base = 0.4 + Math.random() * 0.3;
      const trendFactor = trend === 'up' ? i * 0.06 : trend === 'down' ? (6 - i) * 0.06 : 0;
      bars.push(Math.min(Math.max(base + trendFactor, 0.15), 1));
    }
    return bars;
  }

  $: followerMetric = metric('Followers');
  $: engMetric = metric('Engagement Rate');
  $: reachMetric = metric('Reach (7d)');
  $: saveMetric = metric('Save Rate Proxy');
  $: shareMetric = metric('Share Rate Proxy');
  $: campaignMetric = metric('Active Campaigns');

  $: followerBars = sparkBars(0, 'up');
  $: engBars = sparkBars(0, engMetric?.trend || 'flat');
  $: reachBars = sparkBars(0, reachMetric?.trend || 'flat');
</script>
```

**Template — Rows 1-3 (Brief, Health, 6 Metrics):**

The template renders all cards as siblings (no wrapper div — component uses `display: contents` pattern via the parent bento grid). Each card uses `bs-` prefixed classes.

Row 1: Brief card (span 2) + Brand Health ring card (span 1)
Row 2: Followers (with green sparkline), Eng. Rate (with blue bar chart), Reach (with trend sparkline)
Row 3: Avg. Saves, Shares, Posts/Week

All metric cards show: monospace label, Bodoni Moda number, delta/note, mini sparkline/bars where applicable.

**Styles section:**

All styles scoped, using hardcoded OS tokens:
- `#0A0A0C` background context, `rgba(255,255,255,0.035)` card surface
- `rgba(255,255,255,0.07)` borders, `14px` border-radius
- Geist Mono for labels (8-9px, uppercase, 0.1em tracking)
- Bodoni Moda for metric numbers (20-24px, 700 weight)
- Sparkline bars: 4px wide, colored by trend, opacity gradient
- Health ring: SVG with `stroke-dasharray` / `stroke-dashoffset`

Write the full component file with these 3 rows and complete styles. The remaining rows (insights, posts, direction, audience, ideas, matches, ops) will be added in the next task.

- [ ] **Step 2: Build check**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/BrandOsDashboard.svelte
git commit -m "feat(brand-os): create BrandOsDashboard with brief, health ring, and metrics"
```

---

### Task 4: Add remaining rows to BrandOsDashboard.svelte (Insights, Posts, Direction, Audience, Ideas, Matches, Ops)

**Files:**
- Modify: `src/lib/components/brands/BrandOsDashboard.svelte`

- [ ] **Step 1: Add Row 4 — Insight cards (What's Working, What's Not, Do This Week)**

Add after the metrics cards in the template. Three cards, each span 1:
- What's Working: green left border (3px), green monospace label, italic body from `synopsis.whatHappened`
- What's Not: red left border, red label, italic body from `synopsis.whyItHappened`
- Do This Week: amber left border + amber tinted background, numbered list from `synopsis.whatNext[]`

- [ ] **Step 2: Add Row 5 — Instagram Posts strip (full width)**

Full-width card showing `posts` array as horizontal scroll strip:
- 100px x 100px thumbnails with 10px border-radius
- Real `<img>` from `post.thumbnail`, gradient placeholder fallback when empty
- Bottom overlay gradient with likes + saves count (monospace 8px)
- REEL/CAROUSEL type badge top-left when `post.type !== 'IMAGE'`

- [ ] **Step 3: Add Row 6 — Brand Direction (span 2) + Your Audience (span 1)**

Brand Direction card:
- Description from `audience.summary`
- Vibe tags from `vibes[]` as monospace chips
- Color palette swatches from `paletteColors[]` as 22px circles
- Mood label from `kit.visualDirection.mood`

Your Audience card:
- One-sentence summary in italic quotes from `audience.summary` (truncated to 1 sentence)
- Demographics row: age/gender/city from `audience.keyInsights[0]` (Primary demographic)

- [ ] **Step 4: Add Row 7 — Content Ideas (span 1) + Creator Matches (span 1) + Campaign Ops (span 1)**

Content Ideas card:
- List from `kit.contentCalendar` (first 4 entries): title = concept, format tag from pillar
- Count badge in header

Creator Matches card:
- Show `audience.personas` as creator-like entries (avatar circle with gradient, name, description snippet)
- Count badge in header
- Match % placeholder (display as "—" if no real score available)

Campaign Ops card:
- Active count or "No active campaigns" italic
- Content Pipeline: Draft/Sched/Live/Fail as Bodoni numbers from `contentOps`
- Best Time: from `audience.keyInsights` "Best windows" entry
- Refresh button at bottom calling `onRefresh`

- [ ] **Step 5: Add all styles for rows 4-7**

Add scoped styles for:
- `.bs-card--insight` with colored `border-left: 3px solid` variants (green/red/amber)
- `.bs-card--posts` full-width strip with horizontal scroll
- `.bs-post-thumb` with overlay gradient and type badge
- `.bs-card--direction` span 2 with palette swatches row
- `.bs-card--audience` with italic quote and demographics
- `.bs-card--ideas`, `.bs-card--matches`, `.bs-card--ops` compact list cards
- Responsive breakpoints: 1024px (2-col), 640px (1-col)

- [ ] **Step 6: Build check**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/brands/BrandOsDashboard.svelte
git commit -m "feat(brand-os): add insight cards, Instagram posts, direction, audience, ideas, matches, ops"
```

---

### Task 5: Wire BrandOsDashboard into the portal page

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

- [ ] **Step 1: Replace imports**

Remove these imports (lines 20-25):
```typescript
import BrandPortalExecutive from '$lib/components/brands/BrandPortalExecutive.svelte';
import BrandPortalAudienceInsights from '$lib/components/brands/BrandPortalAudienceInsights.svelte';
import BrandPortalSynopsis from '$lib/components/brands/BrandPortalSynopsis.svelte';
import BrandPortalCampaignOps from '$lib/components/brands/BrandPortalCampaignOps.svelte';
import BrandPortalContentOps from '$lib/components/brands/BrandPortalContentOps.svelte';
import BrandKitPanel from '$lib/components/brands/BrandKitPanel.svelte';
```

Add this import:
```typescript
import BrandOsDashboard from '$lib/components/brands/BrandOsDashboard.svelte';
```

- [ ] **Step 2: Replace the 6 component calls with single BrandOsDashboard**

Replace the block at lines ~939-958 (the `{:else if osDashboard}` branch):

```svelte
      {:else if osDashboard}
        <BrandOsDashboard
          dashboard={osDashboard}
          syncing={osSyncing}
          onRefresh={() => runOsSync('refresh_dashboard')}
          onRegenerateSynopsis={() => runOsSync('regenerate_synopsis')}
          onRegenerateBrandKit={() => runOsSync('regenerate_brand_kit')}
        />
      {/if}
```

This replaces the 6 separate component calls + the refresh button section.

- [ ] **Step 3: Build and verify**

```bash
npx vite build 2>&1 | tail -5
```

Expected: Build succeeds. No unused import warnings for the removed components.

- [ ] **Step 4: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat(brand-os): wire BrandOsDashboard into portal, remove old components"
```

---

### Task 6: Deploy and verify

**Files:** None (deployment only)

- [ ] **Step 1: Deploy to production**

```bash
vercel --prod 2>&1 | tail -15
```

Expected: `readyState: "READY"`

- [ ] **Step 2: Verify the dashboard renders**

Visit `https://wagwanworld.vercel.app/brands/portal` (Content Studio tab). Confirm:
- Top bar shows brand identity + greeting + clock + campaign count
- Brief card renders editorial headline with warm glow
- Health ring shows score with colored arc
- 6 metric cards with sparklines/bar charts
- 3 insight cards with colored left borders and conversational italic text
- Instagram post thumbnails strip (or gradient placeholders if no IG data)
- Brand Direction with vibe tags and palette swatches
- Audience card with quoted sentence + demographics
- Content Ideas, Creator Matches, Campaign Ops in bottom row
- Responsive: resize to tablet/mobile and verify 2-col → 1-col collapse

- [ ] **Step 3: Commit any hotfixes if needed**

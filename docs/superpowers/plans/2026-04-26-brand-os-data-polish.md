# Brand OS Data Quality & UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI bugs (PP Mori font, double %, Posts/Week), fix data plumbing so existing intelligence surfaces properly, and upgrade the daily brief generator from template strings to a conversational LLM call.

**Architecture:** Three independent work streams in sequence: (1) UI component fixes, (2) API data plumbing, (3) LLM brief generator. Each stream produces a working commit. No type changes needed.

**Tech Stack:** SvelteKit, TypeScript, Anthropic SDK (`claude-haiku-4-5-20251001`), Supabase.

**Spec:** `docs/superpowers/specs/2026-04-26-brand-os-data-polish.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/components/brands/BrandOsDashboard.svelte` | MODIFY | PP Mori font, fix double %, fix Posts/Week metric lookup, warmer empty states |
| `src/routes/api/brand/os-dashboard/+server.ts` | MODIFY | Add Posts/Week metric, fix fallback chains, better content calendar |
| `src/lib/server/brand/brandOsEngine.ts` | MODIFY | Replace template `generateDailyBrief()` with Claude call + fallback |
| `src/lib/server/prompts/brand-os.ts` | MODIFY | Add conversational brief prompt text |

---

### Task 1: UI Quick Fixes in BrandOsDashboard.svelte

**Files:**
- Modify: `src/lib/components/brands/BrandOsDashboard.svelte`

- [ ] **Step 1: Fix PP Mori font**

In the `<style>` section, find every occurrence of `font-family: 'Geist Variable', 'Inter', sans-serif` and replace with `font-family: 'PP Mori', 'Geist Variable', 'Inter', -apple-system, sans-serif`. There are approximately 6 occurrences (body text, brief headline, brief body, direction text, audience text, idea text). Do NOT change Geist Mono (labels) or Bodoni Moda (numbers).

- [ ] **Step 2: Fix double % on Engagement Rate**

In the script section, update the `fmt` function to strip trailing `%` from values:

```typescript
function fmt(v: string): string {
  return v?.replace(/%$/, '') || '—';
}
```

This ensures that when the template renders `{fmt(engRate.value)}<span class="bs-metric-suffix">%</span>`, the value "4.19%" becomes "4.19" + "%" instead of "4.19%" + "%".

- [ ] **Step 3: Fix Posts/Week metric lookup**

The `findMetric('post')` call matches "Posts/Week" but the API doesn't include a metric with that label yet (that's fixed in Task 2). For now, add a fallback in the script to also check `keyInsights`:

After the existing `$: postsWeek = findMetric('post');` line (approx line 74), add:

```typescript
$: postsWeekVal = postsWeek.value !== '—' ? postsWeek.value : 
  (aud.keyInsights.find(k => k.title.toLowerCase().includes('posts per'))?.value || '—');
```

Then in the template, replace `{fmt(postsWeek.value)}` with `{fmt(postsWeekVal)}` and replace `{#if parseNum(postsWeek.value) < 2}` with `{#if parseNum(postsWeekVal) < 2}`.

- [ ] **Step 4: Update empty state copy**

Find and replace these strings in the template:

| Find | Replace |
|------|---------|
| `No posts synced yet` | `No Instagram posts yet — they'll appear after your first analysis.` |
| `No personas identified` | `No audience personas yet — run an analysis to discover them.` |
| `No active campaigns` | `No active campaigns yet` |

- [ ] **Step 5: Build and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/lib/components/brands/BrandOsDashboard.svelte
git commit -m "fix(brand-os): PP Mori font, double % fix, Posts/Week fallback, warmer empty states"
```

---

### Task 2: Data Plumbing Fixes in os-dashboard API

**Files:**
- Modify: `src/routes/api/brand/os-dashboard/+server.ts`

- [ ] **Step 1: Add Posts/Week as 7th executive metric**

In the `metrics` array inside the `dashboard` object (after the "Active Campaigns" metric, around line 185), add:

```typescript
        {
          label: 'Posts/Week',
          value: (Number(latest?.posts_per_week ?? 0)).toFixed(1),
          note: Number(latest?.posts_per_week ?? 0) < 2 ? 'Increase recommended' : 'Current pace',
        },
```

- [ ] **Step 2: Fix recentPosts fallback chain**

Replace the `recentPosts` extraction block (lines ~109-116) with:

```typescript
  const rawPosts = Array.isArray(latestIntel.recentPosts)
    ? latestIntel.recentPosts
    : Array.isArray(latestIntel.identity?.recentMedia)
      ? latestIntel.identity.recentMedia
      : [];
  const recentPosts = rawPosts.slice(0, 8).map((p: any) => ({
    id: String(p.id || ''),
    thumbnail: String(p.thumbnail || p.media_url || ''),
    type: String(p.type || p.media_type || 'IMAGE'),
    likes: Number(p.likes ?? p.like_count ?? 0),
    comments: Number(p.comments ?? p.comments_count ?? 0),
    permalink: String(p.permalink || ''),
  }));
```

- [ ] **Step 3: Fix brandVibes fallback chain**

Replace the `brandVibes` extraction block (lines ~118-120) with:

```typescript
  const brandVibes: string[] = (
    Array.isArray(latestIntel.identity?.brandVibes) ? latestIntel.identity.brandVibes :
    Array.isArray(latestIntel.identity?.interests) ? latestIntel.identity.interests :
    Array.isArray(latestIntel.identity?.vibes) ? latestIntel.identity.vibes :
    []
  ).slice(0, 6);
```

- [ ] **Step 4: Fix audience summary fallback chain**

Replace the `summary` field in `audienceInsights` (line ~189-191) with:

```typescript
      summary:
        audiencePortrait.narrative ||
        audiencePortrait.summary ||
        (latestIntel.demographics as any)?.narrative ||
        'We\'re still getting to know your audience. Run an analysis to unlock insights.',
```

- [ ] **Step 5: Fix palette fallback chain**

In the `visualDirection.palette` field (around line 233), replace with:

```typescript
        palette:
          (brand.brand_identity as any)?.visual?.colorPalette?.slice?.(0, 4)?.join(', ') ||
          (brand.brand_identity as any)?.visual?.palette ||
          (latestIntel.identity as any)?.aesthetic?.palette ||
          (latestIntel.identity as any)?.colorPalette ||
          (latestIntel.identity as any)?.aesthetic?.colorPalette ||
          'Need refreshed identity extraction',
```

- [ ] **Step 6: Better content calendar from real data**

Replace the `contentCalendar` assignment (around line 258) with:

```typescript
      contentCalendar: (() => {
        const quickWins: string[] = Array.isArray(strategic.quickWins) ? strategic.quickWins : [];
        const safePillars = pillars.length
          ? pillars.map((p) => p.label)
          : Array.isArray(strategic.contentPillars)
            ? strategic.contentPillars
            : ['Education', 'Proof', 'Community'];
        if (quickWins.length >= 3) {
          return quickWins.slice(0, 7).map((win, i) => ({
            day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7],
            slot: bestHours.length ? `${String(bestHours[i % bestHours.length]?.hour ?? 10).padStart(2, '0')}:00` : '10:00',
            pillar: safePillars[i % safePillars.length],
            concept: win,
          }));
        }
        return inferCalendar(safePillars, bestDays, bestHours);
      })(),
```

- [ ] **Step 7: Update whatHappened/whyItHappened fallbacks**

In the `synopsis` section (around lines 207-213), replace the fallback strings:

```typescript
    synopsis: {
      headline: dailyBrief?.headline || brief?.headline || 'No weekly synopsis yet',
      whatHappened:
        dailyBrief?.synopsis ||
        brief?.sections?.whats_working ||
        'Your numbers are here — run an analysis to turn them into a story.',
      whyItHappened:
        findings[0]?.summary ||
        brief?.sections?.whats_not ||
        strategic.competitiveGaps ||
        'We need a deeper look to figure out the why. Hit Run Analysis above.',
      whatNext: (() => {
```

- [ ] **Step 8: Build and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/routes/api/brand/os-dashboard/+server.ts
git commit -m "fix(api): add Posts/Week metric, fix data fallback chains, better calendar"
```

---

### Task 3: Add Conversational Brief Prompt

**Files:**
- Modify: `src/lib/server/prompts/brand-os.ts`

- [ ] **Step 1: Add the system and user prompt templates**

Replace the entire file content with:

```typescript
export const BRAND_OS_PROMPT_VERSIONS = {
  insights: 'brand-os-insights-v1',
  brief: 'brand-os-brief-v2',
  predict: 'brand-os-predict-v1',
} as const;

export const DAILY_BRIEF_SYSTEM = `You are a friendly brand strategist who speaks with warmth but backs everything with data. You use "you" and "your" naturally. You're specific — mention actual numbers, percentages, and content types. No corporate jargon. No filler. Write like you're texting a founder you respect about their brand's week.

Rules:
- headline: editorial magazine-style, max 12 words, no quotes
- whatHappened: 2-3 sentences, conversational, reference specific metrics
- whyItHappened: 2-3 sentences, explain the root cause, be direct
- whatNext: exactly 3 items, each starts with a verb, each is a specific action (not generic advice)
- confidenceLabel: "high" if 4+ signals, "medium" if 2-3, "low" if 1 or less

Respond with ONLY valid JSON matching this schema:
{
  "headline": "string",
  "whatHappened": "string", 
  "whyItHappened": "string",
  "whatNext": ["string", "string", "string"],
  "confidenceLabel": "string"
}`;

export function buildDailyBriefUserPrompt(input: {
  brandName: string;
  handle: string;
  engagementRate: number;
  engagementDelta: number;
  reach7d: number;
  reachDelta: number;
  avgSaves: number;
  avgShares: number;
  postsPerWeek: number;
  findings: Array<{ type: string; title: string; summary: string }>;
  topPillars: Array<{ label: string; avgEngagement: number }>;
}): string {
  const f = input.findings;
  const p = input.topPillars;
  return `Brand: ${input.brandName} (${input.handle})

Current metrics:
- Engagement rate: ${input.engagementRate.toFixed(2)}% (${input.engagementDelta > 0 ? '+' : ''}${input.engagementDelta.toFixed(1)}% vs last period)
- Reach (7d): ${input.reach7d.toLocaleString()} (${input.reachDelta > 0 ? '+' : ''}${input.reachDelta.toFixed(1)}% vs last period)
- Avg saves/post: ${input.avgSaves.toFixed(1)}
- Avg shares/post: ${input.avgShares.toFixed(1)}
- Posting frequency: ${input.postsPerWeek.toFixed(1)} posts/week

${f.length ? `Detected signals:\n${f.map((s, i) => `${i + 1}. [${s.type}] ${s.title}: ${s.summary}`).join('\n')}` : 'No signals detected this period.'}

${p.length ? `Top content pillars by engagement:\n${p.map((pl) => `- ${pl.label} (avg eng: ${pl.avgEngagement.toFixed(1)})`).join('\n')}` : ''}

Write a conversational daily brief for this brand.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/prompts/brand-os.ts
git commit -m "feat(prompts): add conversational daily brief prompt with friendly strategist persona"
```

---

### Task 4: Replace generateDailyBrief() with LLM Call

**Files:**
- Modify: `src/lib/server/brand/brandOsEngine.ts`

- [ ] **Step 1: Add Anthropic import and prompt imports**

At the top of the file, after the existing `import { getServiceSupabase }` line, add:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { DAILY_BRIEF_SYSTEM, buildDailyBriefUserPrompt, BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';
```

- [ ] **Step 2: Replace generateDailyBrief function body**

Replace the entire `generateDailyBrief` function (lines 312-352) with:

```typescript
export async function generateDailyBrief(brandIgId: string) {
  const sb = getServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);

  // Gather inputs
  const [findingsRes, snapshotsRes, pillarsRes, brandRes] = await Promise.all([
    sb.from('insight_findings')
      .select('finding_type,title,summary,suggested_action,evidence_metrics')
      .eq('brand_ig_id', brandIgId)
      .order('created_at', { ascending: false })
      .limit(6),
    sb.from('brand_snapshots')
      .select('engagement_rate,reach_7d,avg_saves,avg_shares,posts_per_week')
      .eq('brand_ig_id', brandIgId)
      .order('snapshot_date', { ascending: false })
      .limit(2),
    sb.from('content_pillars')
      .select('label,avg_quality_engagement')
      .eq('brand_ig_id', brandIgId)
      .order('avg_quality_engagement', { ascending: false })
      .limit(4),
    sb.from('brand_accounts')
      .select('ig_name,ig_username')
      .eq('ig_user_id', brandIgId)
      .maybeSingle(),
  ]);

  const findings = (findingsRes.data ?? []).slice(0, 5);
  const snapshots = snapshotsRes.data ?? [];
  const latest = snapshots[0];
  const previous = snapshots[1];
  const pillars = pillarsRes.data ?? [];
  const brand = brandRes.data;

  const engNow = Number(latest?.engagement_rate ?? 0);
  const engPrev = Number(previous?.engagement_rate ?? 0);
  const reachNow = Number(latest?.reach_7d ?? 0);
  const reachPrev = Number(previous?.reach_7d ?? 0);
  const engDelta = engPrev ? ((engNow - engPrev) / engPrev) * 100 : 0;
  const reachDelta = reachPrev ? ((reachNow - reachPrev) / reachPrev) * 100 : 0;

  // Try LLM-powered brief
  let headline: string;
  let synopsis: string;
  let actions: Array<{ title: string; action: string; type: string }>;
  let whatNext: string[];

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const userPrompt = buildDailyBriefUserPrompt({
      brandName: brand?.ig_name || 'Brand',
      handle: brand?.ig_username ? `@${brand.ig_username}` : '@brand',
      engagementRate: engNow,
      engagementDelta: engDelta,
      reach7d: reachNow,
      reachDelta: reachDelta,
      avgSaves: Number(latest?.avg_saves ?? 0),
      avgShares: Number(latest?.avg_shares ?? 0),
      postsPerWeek: Number(latest?.posts_per_week ?? 0),
      findings: findings.map((f) => ({
        type: f.finding_type,
        title: f.title,
        summary: f.summary,
      })),
      topPillars: pillars.map((p) => ({
        label: p.label,
        avgEngagement: Number(p.avg_quality_engagement ?? 0),
      })),
    });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: DAILY_BRIEF_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text.trim());

    headline = parsed.headline || 'Weekly brand check-in';
    synopsis = parsed.whatHappened || 'Analysis complete.';
    whatNext = Array.isArray(parsed.whatNext) ? parsed.whatNext.slice(0, 3) : [];
    actions = whatNext.map((a: string) => ({ title: a, action: a, type: 'recommendation' }));

    // Also store whyItHappened in synopsis field for the daily_briefs table
    // (the os-dashboard API reads both headline and synopsis)
    const fullSynopsis = `${parsed.whatHappened} ${parsed.whyItHappened || ''}`.trim();
    synopsis = fullSynopsis;
  } catch (err) {
    // Fallback to template strings if LLM fails
    console.error('[brand-os] LLM brief failed, using template fallback:', err);
    const top = findings.slice(0, 3);
    headline = top.length
      ? `${top[0].finding_type}: ${top[0].title}`
      : 'No critical shifts detected today';
    synopsis = top.length
      ? `Detected ${top.length} insight signals. Prioritize ${top[0].finding_type.toLowerCase()} action first.`
      : 'System is healthy; gather more data for stronger guidance.';
    actions = top.map((f) => ({
      title: f.title,
      action: f.suggested_action,
      type: f.finding_type,
    }));
    whatNext = actions.map((a) => a.action).filter(Boolean);
  }

  const evidence = findings.map((f) => ({
    type: f.finding_type,
    summary: f.summary,
    metrics: f.evidence_metrics,
  }));

  await sb.from('daily_briefs').upsert(
    {
      brand_ig_id: brandIgId,
      brief_date: today,
      headline,
      synopsis,
      actions,
      evidence,
      prompt_version: BRAND_OS_PROMPT_VERSIONS.brief,
    },
    { onConflict: 'brand_ig_id,brief_date' },
  );

  return { headline, synopsis, actions, evidence };
}
```

- [ ] **Step 3: Build and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/lib/server/brand/brandOsEngine.ts
git commit -m "feat(brand-os): replace template daily brief with Claude-powered conversational output"
```

---

### Task 5: Deploy and Verify

**Files:** None (deployment only)

- [ ] **Step 1: Deploy to production**

```bash
vercel --prod 2>&1 | tail -15
```

Expected: `readyState: "READY"`

- [ ] **Step 2: Verify UI fixes**

Visit `https://wagwanworld.vercel.app/brands/portal`:
- Font should be PP Mori for body text
- Eng. Rate should show `4.19%` (not `4.19%%`)
- Posts/Week should show `0.7` (not `—`)
- Empty states should use warmer copy

- [ ] **Step 3: Trigger a brief regeneration**

Click "Refresh Data" on the dashboard to trigger `runOsSync('refresh_dashboard')`. This calls the cron pipeline which now uses the LLM brief. After refresh:
- "What's Working" should show conversational quoted text
- "What's Not" should show conversational explanation
- "Do This Week" should show 3 specific verb-led actions
- Brief headline should be editorial, not `"DRIFT: Quality engagement is drifting down"`

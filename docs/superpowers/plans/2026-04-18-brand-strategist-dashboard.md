# Brand Strategist Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal brand strategist dashboard that analyses every signal from the Instagram API and presents actionable intelligence — best posting times, brand direction, content ideas, audience DNA, engagement breakdown — styled in the editorial magazine aesthetic.

**Architecture:** A new API endpoint (`/api/brand/strategist`) orchestrates data from existing endpoints (profile-stats, insights, extract-identity) into a single payload. A new Svelte component (`BrandStrategist.svelte`) renders the dashboard as an editorial magazine spread with 6 sections. Data loads progressively — profile stats first (fast), then AI analysis (slower, cached).

**Tech Stack:** SvelteKit, Instagram Graph API v25.0, Anthropic Claude (for brand direction + content ideas), Supabase (caching), existing editorial token system.

---

## File Structure

| File | Role |
|------|------|
| `src/routes/api/brand/strategist/+server.ts` | **New.** Orchestrator endpoint — aggregates profile, engagement, insights, identity, and generates strategic recommendations via Claude |
| `src/lib/components/brands/BrandStrategist.svelte` | **New.** Full dashboard component — 6 editorial sections |
| `src/lib/components/brands/StratPostingHeatmap.svelte` | **New.** 7×24 day/hour heatmap showing best posting times |
| `src/lib/components/brands/StratContentIdeas.svelte` | **New.** AI-generated content ideas as editorial cards |
| `src/lib/components/brands/StratAudienceDNA.svelte` | **New.** Audience breakdown — interests, behaviors, perception |
| `src/lib/components/brands/StratBrandDirection.svelte` | **New.** Brand positioning + strategic recommendations |
| `src/lib/components/brands/StratEngagementBreakdown.svelte` | **New.** Per-post engagement analysis with top/bottom performers |
| `src/lib/components/brands/StratVisualIdentity.svelte` | **New.** Color palette, aesthetic analysis, visual DNA |
| `src/routes/brands/portal/+page.svelte` | **Modify.** Wire BrandStrategist into the Content Studio tab, replacing/augmenting current layout |

---

## Task 1: Build the Strategist API Endpoint

**Files:**
- Create: `src/routes/api/brand/strategist/+server.ts`

This endpoint aggregates all brand intelligence into a single response. It calls existing functions, adds Claude analysis for strategic recommendations, and caches the result.

- [ ] **Step 1: Create the strategist endpoint**

```typescript
// src/routes/api/brand/strategist/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw error(500, 'Supabase not configured');

  // 1. Fetch brand account (token + stored identity)
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token,ig_username,ig_name,ig_profile_picture,ig_followers_count,brand_identity,identity_updated_at&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brand = brands[0];
  const token = brand.ig_access_token;

  // 2. Fetch live profile from Instagram
  const profileRes = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
  );
  const profile = profileRes.ok ? await profileRes.json() : {};

  // 3. Fetch last 25 posts with engagement
  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url&limit=25&access_token=${token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const posts = (mediaJson.data || []) as Array<{
    id: string; caption?: string; media_type: string; timestamp: string;
    like_count?: number; comments_count?: number; permalink?: string;
    thumbnail_url?: string; media_url?: string;
  }>;

  // 4. Compute engagement metrics
  let totalLikes = 0, totalComments = 0;
  const postMetrics: Array<{
    id: string; type: string; timestamp: string; likes: number;
    comments: number; engagement: number; caption: string;
    permalink: string; thumbnail: string;
  }> = [];

  for (const p of posts) {
    const likes = p.like_count || 0;
    const comments = p.comments_count || 0;
    totalLikes += likes;
    totalComments += comments;
    postMetrics.push({
      id: p.id,
      type: p.media_type,
      timestamp: p.timestamp,
      likes,
      comments,
      engagement: likes + comments,
      caption: (p.caption || '').slice(0, 200),
      permalink: p.permalink || '',
      thumbnail: p.thumbnail_url || p.media_url || '',
    });
  }

  const avgEngagement = posts.length ? Math.round((totalLikes + totalComments) / posts.length) : 0;
  const engagementRate = profile.followers_count
    ? +((totalLikes + totalComments) / posts.length / profile.followers_count * 100).toFixed(2)
    : 0;

  // 5. Best posting times — group by day-of-week × hour
  const hourDayMap: Record<string, { total: number; count: number }> = {};
  const hourMap: Record<number, { total: number; count: number }> = {};
  const dayMap: Record<number, { total: number; count: number }> = {};

  for (const p of postMetrics) {
    const d = new Date(p.timestamp);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    const key = `${day}-${hour}`;
    const eng = p.engagement;

    if (!hourDayMap[key]) hourDayMap[key] = { total: 0, count: 0 };
    hourDayMap[key].total += eng;
    hourDayMap[key].count += 1;

    if (!hourMap[hour]) hourMap[hour] = { total: 0, count: 0 };
    hourMap[hour].total += eng;
    hourMap[hour].count += 1;

    if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
    dayMap[day].total += eng;
    dayMap[day].count += 1;
  }

  // Best hours (sorted by avg engagement)
  const bestHours = Object.entries(hourMap)
    .map(([h, v]) => ({ hour: +h, avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 5);

  // Best days
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bestDays = Object.entries(dayMap)
    .map(([d, v]) => ({ day: dayNames[+d], avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  // Heatmap data (day × hour → avg engagement)
  const heatmap: Array<{ day: number; hour: number; avg: number }> = [];
  for (const [key, v] of Object.entries(hourDayMap)) {
    const [d, h] = key.split('-').map(Number);
    heatmap.push({ day: d, hour: h, avg: Math.round(v.total / v.count) });
  }

  // 6. Posting frequency
  let postsPerWeek = 0;
  if (posts.length >= 2) {
    const newest = new Date(posts[0].timestamp).getTime();
    const oldest = new Date(posts[posts.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((posts.length / daySpan) * 7 * 10) / 10 : 0;
  }

  // 7. Content type breakdown
  const typeBreakdown: Record<string, { count: number; totalEng: number }> = {};
  for (const p of postMetrics) {
    if (!typeBreakdown[p.type]) typeBreakdown[p.type] = { count: 0, totalEng: 0 };
    typeBreakdown[p.type].count += 1;
    typeBreakdown[p.type].totalEng += p.engagement;
  }
  const contentTypes = Object.entries(typeBreakdown)
    .map(([type, v]) => ({ type, count: v.count, avgEng: Math.round(v.totalEng / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  // 8. Top & bottom performers
  const sorted = [...postMetrics].sort((a, b) => b.engagement - a.engagement);
  const topPosts = sorted.slice(0, 3);
  const bottomPosts = sorted.slice(-3).reverse();

  // 9. Growth trend — compare first half vs second half engagement
  const half = Math.floor(postMetrics.length / 2);
  const recentHalf = postMetrics.slice(0, half);
  const olderHalf = postMetrics.slice(half);
  const recentAvg = recentHalf.length
    ? recentHalf.reduce((s, p) => s + p.engagement, 0) / recentHalf.length
    : 0;
  const olderAvg = olderHalf.length
    ? olderHalf.reduce((s, p) => s + p.engagement, 0) / olderHalf.length
    : 0;
  const growthTrend = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

  // 10. Hashtag analysis from captions
  const hashtagCounts: Record<string, number> = {};
  for (const p of posts) {
    const tags = (p.caption || '').match(/#[\w]+/g) || [];
    for (const t of tags) {
      const lower = t.toLowerCase();
      hashtagCounts[lower] = (hashtagCounts[lower] || 0) + 1;
    }
  }
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // 11. Stored brand identity (from previous extraction)
  const brandIdentity = brand.brand_identity || null;

  // 12. Claude strategic analysis — brand direction + content ideas
  let strategy: {
    brandDirection: string;
    audienceSummary: string;
    contentPillars: string[];
    contentIdeas: Array<{ title: string; format: string; hook: string; why: string }>;
    captionStyle: string;
    competitiveEdge: string;
    quickWins: string[];
  } | null = null;

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (anthropicKey && posts.length >= 3) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const captionSample = posts
        .filter(p => p.caption)
        .slice(0, 8)
        .map((p, i) => `Post ${i + 1} (${p.media_type}, ${p.like_count} likes): ${(p.caption || '').slice(0, 300)}`)
        .join('\n');

      const identityContext = brandIdentity
        ? `Brand identity signals: aesthetic=${brandIdentity.aesthetic || '?'}, lifestyle=${brandIdentity.lifestyle || '?'}, interests=${(brandIdentity.interests || []).join(', ')}, brandVibes=${(brandIdentity.brandVibes || []).join(', ')}, captionIntent=${brandIdentity.captionIntent || '?'}, personality=${JSON.stringify(brandIdentity.personality || {})}`
        : 'No prior brand identity extraction available.';

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are a brand strategist analysing an Instagram account. Return ONLY valid JSON, no markdown.

Account: @${profile.username || brand.ig_username} — ${profile.name || brand.ig_name}
Bio: ${profile.biography || 'none'}
Followers: ${profile.followers_count || brand.ig_followers_count}
Engagement rate: ${engagementRate}%
Posts/week: ${postsPerWeek}
Best content type: ${contentTypes[0]?.type || 'unknown'}
Growth trend: ${growthTrend > 0 ? '+' : ''}${growthTrend}%
Top hashtags: ${topHashtags.slice(0, 6).map(h => h.tag).join(', ')}
${identityContext}

Recent captions:
${captionSample}

Return this exact JSON structure:
{
  "brandDirection": "2-3 sentence strategic positioning recommendation for this brand",
  "audienceSummary": "1-2 sentences describing who their audience likely is based on content + engagement patterns",
  "contentPillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
  "contentIdeas": [
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work for their audience"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"}
  ],
  "captionStyle": "1-2 sentence recommendation for caption voice and tone",
  "competitiveEdge": "1-2 sentences on what makes this brand's content unique or what they should lean into",
  "quickWins": ["quick win 1", "quick win 2", "quick win 3"]
}`
        }]
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      strategy = JSON.parse(text);
    } catch {
      // Claude analysis failed — dashboard still works without it
    }
  }

  // 13. Scheduled posts count
  const scheduledRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=status`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const scheduledPosts = scheduledRes.ok ? await scheduledRes.json() : [];

  return json({
    ok: true,
    profile: {
      username: profile.username || brand.ig_username,
      name: profile.name || brand.ig_name,
      biography: profile.biography || '',
      profilePicture: profile.profile_picture_url || brand.ig_profile_picture,
      followersCount: profile.followers_count || brand.ig_followers_count || 0,
      followingCount: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
    },
    engagement: {
      rate: engagementRate,
      avgPerPost: avgEngagement,
      totalLikes,
      totalComments,
      postsPerWeek,
      growthTrend,
    },
    postingTimes: {
      bestHours,
      bestDays,
      heatmap,
    },
    contentTypes,
    topPosts,
    bottomPosts,
    topHashtags,
    strategy,
    brandIdentity,
    scheduling: {
      scheduled: scheduledPosts.filter((p: { status: string }) => p.status === 'scheduled').length,
      published: scheduledPosts.filter((p: { status: string }) => p.status === 'published').length,
    },
  });
};
```

- [ ] **Step 2: Verify endpoint compiles**

Run: `npx svelte-kit sync && npx tsc --noEmit --pretty 2>&1 | grep 'strategist'`
Expected: No errors related to strategist endpoint.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/brand/strategist/+server.ts
git commit -m "feat(brand): add strategist API endpoint — aggregates IG data + Claude strategy"
```

---

## Task 2: Build the Posting Heatmap Component

**Files:**
- Create: `src/lib/components/brands/StratPostingHeatmap.svelte`

A 7-row × 24-column grid showing engagement density by day and hour. Each cell is color-coded by average engagement. Best time slots are highlighted.

- [ ] **Step 1: Create the heatmap component**

```svelte
<!-- src/lib/components/brands/StratPostingHeatmap.svelte -->
<script lang="ts">
  export let heatmap: Array<{ day: number; hour: number; avg: number }> = [];
  export let bestHours: Array<{ hour: number; avgEng: number }> = [];
  export let bestDays: Array<{ day: string; avgEng: number }> = [];

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Build lookup
  const lookup: Record<string, number> = {};
  let maxAvg = 1;
  for (const h of heatmap) {
    const key = `${h.day}-${h.hour}`;
    lookup[key] = h.avg;
    if (h.avg > maxAvg) maxAvg = h.avg;
  }

  function cellOpacity(day: number, hour: number): number {
    const val = lookup[`${day}-${hour}`] || 0;
    return val / maxAvg;
  }

  function formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  }

  // Top 3 best slots
  const bestSlots = [...heatmap]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(s => `${dayLabels[s.day]} ${formatHour(s.hour)}`);
</script>

<section class="heatmap-section">
  <div class="heatmap-header">
    <span class="ed-kicker">When to Post</span>
    <h3 class="heatmap-title">Best Posting Times</h3>
    <p class="heatmap-sub">Based on engagement patterns across your last 25 posts. Darker cells = higher engagement.</p>
  </div>

  {#if heatmap.length > 0}
    <div class="heatmap-grid">
      <!-- Hour labels -->
      <div class="heatmap-corner"></div>
      {#each hours as h}
        {#if h % 3 === 0}
          <span class="hour-label">{formatHour(h)}</span>
        {:else}
          <span class="hour-label hour-label--minor"></span>
        {/if}
      {/each}

      <!-- Day rows -->
      {#each dayLabels as dayLabel, dayIdx}
        <span class="day-label">{dayLabel}</span>
        {#each hours as hour}
          {@const opacity = cellOpacity(dayIdx, hour)}
          <div
            class="heatmap-cell"
            style="--opacity: {opacity}"
            title="{dayLabel} {formatHour(hour)}: avg {lookup[`${dayIdx}-${hour}`] || 0} engagement"
          ></div>
        {/each}
      {/each}
    </div>

    <!-- Quick insights -->
    <div class="timing-insights">
      <div class="timing-card">
        <span class="timing-label">Peak Slots</span>
        <span class="timing-value">{bestSlots.join(', ')}</span>
      </div>
      {#if bestDays.length > 0}
        <div class="timing-card">
          <span class="timing-label">Best Day</span>
          <span class="timing-value">{bestDays[0].day}</span>
        </div>
      {/if}
      {#if bestHours.length > 0}
        <div class="timing-card">
          <span class="timing-label">Best Hour</span>
          <span class="timing-value">{formatHour(bestHours[0].hour)}</span>
        </div>
      {/if}
    </div>
  {:else}
    <p class="no-data">Not enough posting data yet. Post at least 5 times to see patterns.</p>
  {/if}
</section>

<style>
  .heatmap-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .heatmap-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .heatmap-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .heatmap-sub {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    margin: 0;
    line-height: 1.5;
    max-width: 480px;
  }

  .heatmap-grid {
    display: grid;
    grid-template-columns: 40px repeat(24, 1fr);
    gap: 2px;
    overflow-x: auto;
  }

  .heatmap-corner { width: 40px; }

  .hour-label {
    font-family: var(--ed-font-mono, monospace);
    font-size: 9px;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    text-align: center;
    padding-bottom: 4px;
  }
  .hour-label--minor { visibility: hidden; }

  .day-label {
    font-family: var(--ed-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    display: flex;
    align-items: center;
    padding-right: 6px;
  }

  .heatmap-cell {
    aspect-ratio: 1;
    background: var(--ed-accent, #E63B2E);
    opacity: var(--opacity, 0);
    border-radius: 2px;
    min-width: 12px;
    transition: opacity 0.2s;
  }
  .heatmap-cell:hover {
    outline: 1px solid var(--ed-ink, #1a1a2e);
    outline-offset: 1px;
  }

  .timing-insights {
    display: flex;
    gap: 0;
    border-top: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    padding-top: 16px;
  }

  .timing-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 24px;
    border-right: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
  }
  .timing-card:first-child { padding-left: 0; }
  .timing-card:last-child { border-right: none; }

  .timing-label {
    font-family: var(--ed-font-body, sans-serif);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .timing-value {
    font-family: var(--ed-font-mono, monospace);
    font-size: var(--ed-text-sm, 0.8125rem);
    font-weight: 600;
    color: var(--ed-ink, #1a1a2e);
  }

  .no-data {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    font-style: italic;
    margin: 0;
  }

  @media (max-width: 600px) {
    .timing-insights { flex-direction: column; gap: 12px; }
    .timing-card { padding: 8px 0; border-right: none; border-bottom: 1px solid var(--ed-rule, rgba(20,24,32,0.12)); }
    .timing-card:last-child { border-bottom: none; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/StratPostingHeatmap.svelte
git commit -m "feat(brand): add posting heatmap component"
```

---

## Task 3: Build the Content Ideas Component

**Files:**
- Create: `src/lib/components/brands/StratContentIdeas.svelte`

AI-generated content ideas rendered as editorial index cards with format badges, hooks, and reasoning.

- [ ] **Step 1: Create the content ideas component**

```svelte
<!-- src/lib/components/brands/StratContentIdeas.svelte -->
<script lang="ts">
  export let ideas: Array<{
    title: string;
    format: string;
    hook: string;
    why: string;
  }> = [];
  export let captionStyle: string = '';
  export let contentPillars: string[] = [];
</script>

<section class="ideas-section">
  <div class="ideas-header">
    <span class="ed-kicker">Content Strategy</span>
    <h3 class="ideas-title">Post Ideas for This Week</h3>
    {#if captionStyle}
      <p class="ideas-voice">Voice note: {captionStyle}</p>
    {/if}
  </div>

  {#if contentPillars.length > 0}
    <div class="pillars">
      <span class="pillars-label">Content Pillars</span>
      <div class="pillar-tags">
        {#each contentPillars as pillar}
          <span class="pillar-tag">{pillar}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if ideas.length > 0}
    <div class="ideas-grid">
      {#each ideas as idea, i}
        <article class="idea-card" style="--i:{i}">
          <div class="idea-top">
            <span class="idea-num">{String(i + 1).padStart(2, '0')}</span>
            <span class="idea-format" data-format={idea.format}>{idea.format}</span>
          </div>
          <h4 class="idea-title">{idea.title}</h4>
          <p class="idea-hook">&ldquo;{idea.hook}&rdquo;</p>
          <p class="idea-why">{idea.why}</p>
        </article>
      {/each}
    </div>
  {:else}
    <p class="no-data">Connect your Instagram to get AI-generated content ideas tailored to your brand.</p>
  {/if}
</section>

<style>
  .ideas-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .ideas-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ideas-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .ideas-voice {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-style: italic;
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    margin: 0;
    line-height: 1.5;
  }

  .pillars {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pillars-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .pillar-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .pillar-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }

  .ideas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--ed-gutter, 24px);
  }

  .idea-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 0;
    border-top: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    opacity: 0;
    transform: translateY(12px);
    animation: reveal 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-delay: calc(var(--i, 0) * 80ms);
  }

  @keyframes reveal {
    to { opacity: 1; transform: translateY(0); }
  }

  .idea-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .idea-num {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-style: italic;
    font-size: 1.25rem;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .idea-format {
    font-family: var(--ed-font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }
  .idea-format[data-format="REEL"] {
    border-color: var(--ed-accent, #E63B2E);
    color: var(--ed-accent, #E63B2E);
  }

  .idea-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: 1.0625rem;
    font-weight: 400;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
    line-height: 1.25;
  }

  .idea-hook {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-style: italic;
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    margin: 0;
    line-height: 1.4;
  }

  .idea-why {
    font-size: var(--ed-text-xs, 0.6875rem);
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    margin: 0;
    line-height: 1.5;
  }

  .no-data {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    font-style: italic;
    margin: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/StratContentIdeas.svelte
git commit -m "feat(brand): add AI content ideas component"
```

---

## Task 4: Build the Brand Direction Component

**Files:**
- Create: `src/lib/components/brands/StratBrandDirection.svelte`

Brand positioning, competitive edge, and quick wins — rendered as an editorial editorial pull-quote spread.

- [ ] **Step 1: Create the brand direction component**

```svelte
<!-- src/lib/components/brands/StratBrandDirection.svelte -->
<script lang="ts">
  export let brandDirection: string = '';
  export let audienceSummary: string = '';
  export let competitiveEdge: string = '';
  export let quickWins: string[] = [];
  export let brandIdentity: {
    aesthetic?: string;
    lifestyle?: string;
    brandVibes?: string[];
    interests?: string[];
    captionIntent?: string;
  } | null = null;
</script>

<section class="direction-section">
  <div class="direction-header">
    <span class="ed-kicker">Brand Direction</span>
    <h3 class="direction-title">Strategic Positioning</h3>
  </div>

  <div class="direction-grid">
    <!-- Main direction — pull quote style -->
    {#if brandDirection}
      <div class="direction-main">
        <blockquote class="direction-quote">{brandDirection}</blockquote>
      </div>
    {/if}

    <!-- Sidebar facts -->
    <div class="direction-sidebar">
      {#if audienceSummary}
        <div class="sidebar-block">
          <span class="sidebar-label">Your Audience</span>
          <p class="sidebar-text">{audienceSummary}</p>
        </div>
      {/if}

      {#if competitiveEdge}
        <div class="sidebar-block">
          <span class="sidebar-label">Competitive Edge</span>
          <p class="sidebar-text">{competitiveEdge}</p>
        </div>
      {/if}

      {#if brandIdentity}
        <div class="sidebar-block">
          <span class="sidebar-label">Brand DNA</span>
          <div class="dna-tags">
            {#if brandIdentity.aesthetic}
              <span class="dna-tag">{brandIdentity.aesthetic}</span>
            {/if}
            {#if brandIdentity.lifestyle}
              <span class="dna-tag">{brandIdentity.lifestyle}</span>
            {/if}
            {#each (brandIdentity.brandVibes || []).slice(0, 3) as vibe}
              <span class="dna-tag">{vibe}</span>
            {/each}
            {#if brandIdentity.captionIntent}
              <span class="dna-tag">{brandIdentity.captionIntent}</span>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Quick wins -->
  {#if quickWins.length > 0}
    <div class="quick-wins">
      <span class="wins-label">Quick Wins</span>
      <ol class="wins-list">
        {#each quickWins as win}
          <li class="win-item">{win}</li>
        {/each}
      </ol>
    </div>
  {/if}
</section>

<style>
  .direction-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .direction-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .direction-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .direction-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: var(--ed-gutter-wide, 40px);
    align-items: start;
  }

  .direction-quote {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-style: italic;
    font-size: clamp(1.25rem, 2.5vw, 1.625rem);
    line-height: 1.35;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
    padding-left: 20px;
    border-left: 2px solid var(--ed-accent, #E63B2E);
  }

  .direction-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-left: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    padding-left: var(--ed-gutter, 24px);
  }

  .sidebar-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sidebar-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .sidebar-text {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    line-height: 1.55;
    margin: 0;
  }

  .dna-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .dna-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    border: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }

  .quick-wins {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    padding-top: 20px;
  }

  .wins-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-accent, #E63B2E);
  }

  .wins-list {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .win-item {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink, #1a1a2e);
    line-height: 1.5;
  }
  .win-item::marker {
    color: var(--ed-accent, #E63B2E);
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-style: italic;
  }

  @media (max-width: 700px) {
    .direction-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .direction-sidebar {
      border-left: none;
      padding-left: 0;
      border-top: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
      padding-top: 20px;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/StratBrandDirection.svelte
git commit -m "feat(brand): add brand direction + positioning component"
```

---

## Task 5: Build the Engagement Breakdown Component

**Files:**
- Create: `src/lib/components/brands/StratEngagementBreakdown.svelte`

Shows engagement rate, growth trend, content type performance, and top/bottom posts.

- [ ] **Step 1: Create the engagement breakdown component**

```svelte
<!-- src/lib/components/brands/StratEngagementBreakdown.svelte -->
<script lang="ts">
  export let rate: number = 0;
  export let avgPerPost: number = 0;
  export let postsPerWeek: number = 0;
  export let growthTrend: number = 0;
  export let contentTypes: Array<{ type: string; count: number; avgEng: number }> = [];
  export let topPosts: Array<{
    id: string; type: string; likes: number; comments: number;
    engagement: number; caption: string; permalink: string; thumbnail: string;
  }> = [];
  export let topHashtags: Array<{ tag: string; count: number }> = [];

  const typeLabels: Record<string, string> = {
    IMAGE: 'Feed Post',
    VIDEO: 'Video',
    CAROUSEL_ALBUM: 'Carousel',
    REELS: 'Reel',
  };

  // Max engagement for bar scaling
  $: maxTypeEng = Math.max(...contentTypes.map(t => t.avgEng), 1);
</script>

<section class="engagement-section">
  <div class="engagement-header">
    <span class="ed-kicker">Performance</span>
    <h3 class="engagement-title">Engagement Breakdown</h3>
  </div>

  <!-- Stats row -->
  <div class="stats-row">
    <div class="eng-stat">
      <span class="eng-stat-num">{rate}%</span>
      <span class="eng-stat-label">Engagement Rate</span>
    </div>
    <div class="eng-stat">
      <span class="eng-stat-num">{avgPerPost}</span>
      <span class="eng-stat-label">Avg. per Post</span>
    </div>
    <div class="eng-stat">
      <span class="eng-stat-num">{postsPerWeek}</span>
      <span class="eng-stat-label">Posts / Week</span>
    </div>
    <div class="eng-stat">
      <span class="eng-stat-num" class:positive={growthTrend > 0} class:negative={growthTrend < 0}>
        {growthTrend > 0 ? '+' : ''}{growthTrend}%
      </span>
      <span class="eng-stat-label">Growth Trend</span>
    </div>
  </div>

  <!-- Content type performance -->
  {#if contentTypes.length > 0}
    <div class="type-perf">
      <span class="perf-label">By Content Type</span>
      {#each contentTypes as ct}
        <div class="type-row">
          <span class="type-name">{typeLabels[ct.type] || ct.type}</span>
          <div class="type-bar-wrap">
            <div class="type-bar" style="width: {(ct.avgEng / maxTypeEng) * 100}%"></div>
          </div>
          <span class="type-avg">{ct.avgEng}</span>
          <span class="type-count">{ct.count} posts</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Top posts -->
  {#if topPosts.length > 0}
    <div class="top-posts">
      <span class="perf-label">Top Performing</span>
      <div class="posts-strip">
        {#each topPosts as post, i}
          <a href={post.permalink} target="_blank" rel="noopener" class="post-thumb" title="{post.likes} likes, {post.comments} comments">
            {#if post.thumbnail}
              <img src={post.thumbnail} alt="" class="thumb-img" />
            {:else}
              <div class="thumb-placeholder">{typeLabels[post.type] || post.type}</div>
            {/if}
            <div class="thumb-overlay">
              <span class="thumb-eng">{post.engagement}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Top hashtags -->
  {#if topHashtags.length > 0}
    <div class="hashtag-strip">
      <span class="perf-label">Top Hashtags</span>
      <div class="hashtag-tags">
        {#each topHashtags as ht}
          <span class="hashtag-tag">{ht.tag} <span class="hashtag-count">{ht.count}</span></span>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .engagement-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .engagement-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .engagement-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .stats-row {
    display: flex;
    gap: 0;
    border-top: 2px solid var(--ed-ink, #1a1a2e);
    border-bottom: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    padding: 16px 0;
  }

  .eng-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-right: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
  }
  .eng-stat:last-child { border-right: none; }

  .eng-stat-num {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--ed-ink, #1a1a2e);
  }
  .eng-stat-num.positive { color: #059669; }
  .eng-stat-num.negative { color: #e11d48; }

  .eng-stat-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .perf-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    margin-bottom: 8px;
    display: block;
  }

  .type-perf {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .type-row {
    display: grid;
    grid-template-columns: 80px 1fr 40px 60px;
    align-items: center;
    gap: 10px;
  }

  .type-name {
    font-family: var(--ed-font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }

  .type-bar-wrap {
    height: 6px;
    background: var(--ed-rule-light, rgba(20,24,32,0.06));
    overflow: hidden;
  }

  .type-bar {
    height: 100%;
    background: var(--ed-accent, #E63B2E);
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .type-avg {
    font-family: var(--ed-font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    color: var(--ed-ink, #1a1a2e);
    text-align: right;
  }

  .type-count {
    font-size: 10px;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    text-align: right;
  }

  .top-posts { display: flex; flex-direction: column; }

  .posts-strip {
    display: flex;
    gap: 10px;
  }

  .post-thumb {
    position: relative;
    width: 100px;
    height: 100px;
    overflow: hidden;
    display: block;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ed-bg-deep, oklch(94% 0.010 72));
    font-family: var(--ed-font-mono, monospace);
    font-size: 9px;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .thumb-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 6px;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  }

  .thumb-eng {
    font-family: var(--ed-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    color: white;
  }

  .hashtag-strip { display: flex; flex-direction: column; }

  .hashtag-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .hashtag-tag {
    font-family: var(--ed-font-mono, monospace);
    font-size: 11px;
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    padding: 4px 8px;
    border: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
  }

  .hashtag-count {
    font-weight: 600;
    color: var(--ed-ink, #1a1a2e);
  }

  @media (max-width: 600px) {
    .stats-row { flex-wrap: wrap; }
    .eng-stat { min-width: 45%; border-bottom: 1px solid var(--ed-rule, rgba(20,24,32,0.12)); padding: 12px 0; }
    .type-row { grid-template-columns: 70px 1fr 36px; }
    .type-count { display: none; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/StratEngagementBreakdown.svelte
git commit -m "feat(brand): add engagement breakdown component"
```

---

## Task 6: Build the Main BrandStrategist Dashboard Component

**Files:**
- Create: `src/lib/components/brands/BrandStrategist.svelte`

Orchestrates all sub-components, fetches data from `/api/brand/strategist`, handles loading/error states.

- [ ] **Step 1: Create the main dashboard component**

```svelte
<!-- src/lib/components/brands/BrandStrategist.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import StratPostingHeatmap from './StratPostingHeatmap.svelte';
  import StratContentIdeas from './StratContentIdeas.svelte';
  import StratBrandDirection from './StratBrandDirection.svelte';
  import StratEngagementBreakdown from './StratEngagementBreakdown.svelte';

  export let brandProfile: {
    ig_user_id: string;
    ig_username: string;
    ig_name: string;
    ig_profile_picture: string;
    ig_followers_count: number;
  };

  type StrategistData = {
    ok: boolean;
    profile: {
      username: string; name: string; biography: string;
      profilePicture: string; followersCount: number;
      followingCount: number; mediaCount: number;
    };
    engagement: {
      rate: number; avgPerPost: number; postsPerWeek: number;
      growthTrend: number; totalLikes: number; totalComments: number;
    };
    postingTimes: {
      bestHours: Array<{ hour: number; avgEng: number }>;
      bestDays: Array<{ day: string; avgEng: number }>;
      heatmap: Array<{ day: number; hour: number; avg: number }>;
    };
    contentTypes: Array<{ type: string; count: number; avgEng: number }>;
    topPosts: Array<{
      id: string; type: string; likes: number; comments: number;
      engagement: number; caption: string; permalink: string; thumbnail: string;
    }>;
    bottomPosts: typeof topPosts;
    topHashtags: Array<{ tag: string; count: number }>;
    strategy: {
      brandDirection: string;
      audienceSummary: string;
      contentPillars: string[];
      contentIdeas: Array<{ title: string; format: string; hook: string; why: string }>;
      captionStyle: string;
      competitiveEdge: string;
      quickWins: string[];
    } | null;
    brandIdentity: Record<string, unknown> | null;
    scheduling: { scheduled: number; published: number };
  };

  let data: StrategistData | null = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/brand/strategist');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      data = await res.json();
    } catch (e: any) {
      error = e.message || 'Could not load brand intelligence';
    } finally {
      loading = false;
    }
  });
</script>

<div class="strategist">
  {#if loading}
    <div class="strat-loading">
      <div class="strat-spinner"></div>
      <p class="strat-loading-text">Analysing your brand...</p>
      <p class="strat-loading-sub">Pulling signals from Instagram, running AI strategy analysis</p>
    </div>

  {:else if error}
    <div class="strat-error">
      <p class="strat-error-title">Could not load brand intelligence</p>
      <p class="strat-error-sub">{error}</p>
    </div>

  {:else if data}
    <!-- Profile header -->
    <div class="strat-profile-header">
      <div class="strat-profile">
        {#if data.profile.profilePicture}
          <img src={data.profile.profilePicture} alt="" class="strat-avatar" />
        {:else}
          <div class="strat-avatar strat-avatar--fallback">{data.profile.name.charAt(0)}</div>
        {/if}
        <div class="strat-identity">
          <h2 class="strat-name">{data.profile.name}</h2>
          <span class="strat-handle">@{data.profile.username}</span>
          {#if data.profile.biography}
            <p class="strat-bio">{data.profile.biography}</p>
          {/if}
        </div>
      </div>
      <div class="strat-quick-stats">
        <div class="qs">
          <span class="qs-num">{data.profile.followersCount.toLocaleString()}</span>
          <span class="qs-label">Followers</span>
        </div>
        <div class="qs-div"></div>
        <div class="qs">
          <span class="qs-num">{data.profile.mediaCount.toLocaleString()}</span>
          <span class="qs-label">Posts</span>
        </div>
        <div class="qs-div"></div>
        <div class="qs">
          <span class="qs-num">{data.profile.followingCount.toLocaleString()}</span>
          <span class="qs-label">Following</span>
        </div>
      </div>
    </div>

    <!-- Section 1: Brand Direction -->
    {#if data.strategy}
      <div class="strat-section" id="direction">
        <StratBrandDirection
          brandDirection={data.strategy.brandDirection}
          audienceSummary={data.strategy.audienceSummary}
          competitiveEdge={data.strategy.competitiveEdge}
          quickWins={data.strategy.quickWins}
          brandIdentity={data.brandIdentity}
        />
      </div>
    {/if}

    <!-- Section 2: Engagement -->
    <div class="strat-section" id="engagement">
      <StratEngagementBreakdown
        rate={data.engagement.rate}
        avgPerPost={data.engagement.avgPerPost}
        postsPerWeek={data.engagement.postsPerWeek}
        growthTrend={data.engagement.growthTrend}
        contentTypes={data.contentTypes}
        topPosts={data.topPosts}
        topHashtags={data.topHashtags}
      />
    </div>

    <!-- Section 3: Posting Times -->
    <div class="strat-section" id="timing">
      <StratPostingHeatmap
        heatmap={data.postingTimes.heatmap}
        bestHours={data.postingTimes.bestHours}
        bestDays={data.postingTimes.bestDays}
      />
    </div>

    <!-- Section 4: Content Ideas -->
    {#if data.strategy}
      <div class="strat-section" id="ideas">
        <StratContentIdeas
          ideas={data.strategy.contentIdeas}
          captionStyle={data.strategy.captionStyle}
          contentPillars={data.strategy.contentPillars}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .strategist {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Loading ── */
  .strat-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 80px 24px;
    text-align: center;
  }

  .strat-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--ed-rule, rgba(20,24,32,0.12));
    border-top-color: var(--ed-accent, #E63B2E);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .strat-loading-text {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: 1.125rem;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .strat-loading-sub {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    margin: 0;
  }

  /* ── Error ── */
  .strat-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 60px 24px;
    text-align: center;
  }

  .strat-error-title {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: 1.25rem;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
  }

  .strat-error-sub {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    margin: 0;
  }

  /* ── Profile header ── */
  .strat-profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ed-gutter, 24px);
    padding-bottom: var(--ed-gutter-wide, 40px);
    border-bottom: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
    flex-wrap: wrap;
  }

  .strat-profile {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .strat-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
  }

  .strat-avatar--fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ed-bg-deep, oklch(94% 0.010 72));
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: 1.5rem;
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }

  .strat-identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .strat-name {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ed-ink, #1a1a2e);
    margin: 0;
    line-height: 1.15;
  }

  .strat-handle {
    font-family: var(--ed-font-mono, monospace);
    font-size: 0.8125rem;
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
  }

  .strat-bio {
    font-size: var(--ed-text-sm, 0.8125rem);
    color: var(--ed-ink-3, rgba(20,24,32,0.55));
    margin: 4px 0 0;
    max-width: 360px;
    line-height: 1.4;
  }

  .strat-quick-stats {
    display: flex;
    align-items: center;
  }

  .qs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 0 20px;
  }

  .qs-num {
    font-family: var(--ed-font-display, 'Bodoni Moda', Georgia, serif);
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--ed-ink, #1a1a2e);
  }

  .qs-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
  }

  .qs-div {
    width: 1px;
    height: 32px;
    background: var(--ed-rule, rgba(20,24,32,0.12));
  }

  /* ── Sections ── */
  .strat-section {
    padding: var(--ed-gutter-wide, 40px) 0;
    border-bottom: 1px solid var(--ed-rule, rgba(20,24,32,0.12));
  }
  .strat-section:last-child { border-bottom: none; }

  @media (max-width: 600px) {
    .strat-profile-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .strat-quick-stats {
      width: 100%;
      justify-content: flex-start;
    }
    .qs:first-child { padding-left: 0; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/BrandStrategist.svelte
git commit -m "feat(brand): add main BrandStrategist dashboard component"
```

---

## Task 7: Wire BrandStrategist into the Portal Page

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

Replace the current Content Studio tab content (profile header + feature cards + ContentStudio component) with the BrandStrategist component as the primary view, and move ContentStudio below it.

- [ ] **Step 1: Add import**

Add to the `<script>` imports section (around line 18-19):

```typescript
import BrandStrategist from '$lib/components/brands/BrandStrategist.svelte';
```

- [ ] **Step 2: Replace the content tab body**

Replace the `{#if portalTab === 'content' && data.brandProfile}` block content. Remove the old `studio-header`, `studio-features`, and wrap the ContentStudio below the strategist:

```svelte
  {#if portalTab === 'content' && data.brandProfile}
    <div class="portal-content-studio">
      <!-- Brand Strategist Dashboard -->
      <BrandStrategist brandProfile={{
        ig_user_id: String(data.brandProfile.ig_user_id || ''),
        ig_username: String(data.brandProfile.ig_username || ''),
        ig_name: String(data.brandProfile.ig_name || ''),
        ig_profile_picture: String(data.brandProfile.ig_profile_picture || ''),
        ig_followers_count: Number(data.brandProfile.ig_followers_count || 0),
      }} />

      <!-- Content Studio (post creation) below the dashboard -->
      <div class="studio-divider">
        <span class="divider-rule"></span>
        <span class="divider-label">Create & Publish</span>
        <span class="divider-rule"></span>
      </div>
      <ContentStudio brandProfile={{
        ig_user_id: String(data.brandProfile.ig_user_id || ''),
        ig_username: String(data.brandProfile.ig_username || ''),
        ig_name: String(data.brandProfile.ig_name || ''),
        ig_profile_picture: String(data.brandProfile.ig_profile_picture || ''),
        ig_followers_count: Number(data.brandProfile.ig_followers_count || 0),
      }} />
    </div>
```

- [ ] **Step 3: Add divider styles**

Add to the `<style>` block:

```css
  .studio-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: var(--ed-section-gap, 64px) 0 var(--ed-gutter-wide, 40px);
  }
  .divider-rule {
    flex: 1;
    height: 1px;
    background: var(--ed-rule, rgba(20,24,32,0.12));
  }
  .divider-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ed-ink-ghost, rgba(20,24,32,0.3));
    white-space: nowrap;
  }
```

- [ ] **Step 4: Remove old liveStats code and studio-header/feature-cards**

Remove the `liveStats` variable, the `onMount` that fetches profile-stats, the `studio-header` template block, the `studio-features` template block, and all associated CSS (`.studio-header`, `.studio-profile`, `.profile-avatar`, `.profile-name`, `.profile-handle`, `.studio-stats`, `.quick-stat`, `.stat-divider`, `.studio-features`, `.feature-card`, `.feature-num`, `.feature-title`, `.feature-desc`). The BrandStrategist component now handles all of this.

- [ ] **Step 5: Verify it compiles**

Run: `npx svelte-kit sync && npx tsc --noEmit --pretty 2>&1 | grep -i error | grep -v 'Unused CSS'`
Expected: No new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat(brand): wire BrandStrategist dashboard into portal content tab"
```

---

## Task 8: Deploy and Verify

- [ ] **Step 1: Run full type check**

```bash
npm run check
```

- [ ] **Step 2: Deploy to production**

```bash
vercel --prod --force
```

- [ ] **Step 3: Alias to production URL**

```bash
vercel alias <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 4: Verify live**

Visit https://wagwanworld.vercel.app/brands/portal logged in. Confirm:
- Profile header shows correct followers/posts/following
- Brand Direction section loads with strategic positioning
- Engagement Breakdown shows rate, growth, content types, top posts
- Posting Heatmap shows day/hour grid
- Content Ideas shows 5 AI-generated ideas
- ContentStudio upload area appears below the dashboard

---

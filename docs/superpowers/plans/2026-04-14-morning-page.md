# Morning Page + Location + Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page the page you open every morning — time-aware greeting, calendar view, personalized news, music with real artwork, suggested reads, all cached in Redis + Supabase so the LLM doesn't recompute on every load. Add location input to onboarding with monthly update lock.

**Architecture:** A two-layer content cache (Redis hot + Supabase persistent) stores all LLM-generated content. A new `/api/home/morning-brief` endpoint generates personalized news + reads using Brave Search + Claude, caching the result for 24hrs. Artist artwork is fetched from iTunes API and cached in Redis for 30 days. Location is captured in onboarding and locked for 30 days on the profile page. The existing `redisCache.ts` module is extended to support longer TTLs.

**Tech Stack:** SvelteKit, TypeScript, Redis, Supabase, Anthropic SDK, Brave Search API, iTunes Search API

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/server/redisCache.ts` | Raise max TTL from 24hr to 30 days |
| Create | `src/lib/server/contentCache.ts` | Two-layer cache: Redis → Supabase → compute |
| Create | `supabase/008_cached_content.sql` | cached_content table migration |
| Create | `supabase/009_location_updated_at.sql` | location_updated_at column migration |
| Create | `src/routes/api/home/morning-brief/+server.ts` | Morning brief API (news + reads) |
| Create | `src/routes/api/home/artist-artwork/+server.ts` | Artwork cache proxy |
| Create | `src/lib/components/home/CalendarToday.svelte` | Calendar today view component |
| Create | `src/lib/components/home/MorningBrief.svelte` | News cards component |
| Create | `src/lib/components/home/SuggestedReads.svelte` | Reading recommendation cards |
| Modify | `src/lib/components/home/HeroIdentity.svelte` | Time-aware greeting |
| Modify | `src/lib/components/home/ArtistStrip.svelte` | Fetch real artwork on mount |
| Modify | `src/lib/stores/profile.ts` | Add locationUpdatedAt field |
| Modify | `src/routes/onboarding/+page.svelte` | Add location input to Step 0 |
| Modify | `src/routes/(app)/home/+page.svelte` | Wire calendar, brief, reads, artwork |

---

### Task 1: Raise Redis TTL Cap + Create Content Cache Module

**Files:**
- Modify: `src/lib/server/redisCache.ts`
- Create: `src/lib/server/contentCache.ts`

- [ ] **Step 1: Raise Redis max TTL**

In `src/lib/server/redisCache.ts`, line 63, change:

```typescript
  const ex = Math.max(1, Math.min(Math.floor(ttlSec), 86400));
```

To:

```typescript
  const ex = Math.max(1, Math.min(Math.floor(ttlSec), 2_592_000)); // 30 days max
```

- [ ] **Step 2: Add redisDel helper**

After the `redisGetDelJson` function, add:

```typescript
export async function redisDel(key: string): Promise<void> {
  const c = await ensureClient();
  if (!c) return;
  try {
    await c.del(key);
  } catch (e) {
    console.error('[redis] del', key, e);
  }
}
```

- [ ] **Step 3: Create contentCache.ts**

Create `src/lib/server/contentCache.ts`:

```typescript
/**
 * Two-layer content cache: Redis (hot) → Supabase (persistent) → compute.
 * LLM only runs on cache miss.
 */

import { redisGetJson, redisSetJson, redisDel } from './redisCache';
import { getServiceSupabase } from './supabase';

export interface CachedItem<T> {
  payload: T;
  generatedAt: string;
  cached: boolean;
}

const TTL: Record<string, number> = {
  morning_brief: 86_400,       // 24hr
  news_feed: 43_200,           // 12hr
  suggested_reads: 604_800,    // 7 days
  calendar_context: 3_600,     // 1hr
  music_artwork: 2_592_000,    // 30 days
};

function redisKey(googleSub: string, contentType: string): string {
  return `wagwan:${googleSub}:${contentType}`;
}

/**
 * Get from two-layer cache. Returns null if both layers miss.
 */
export async function getCached<T>(
  googleSub: string,
  contentType: string,
): Promise<CachedItem<T> | null> {
  const rKey = redisKey(googleSub, contentType);

  // Layer 1: Redis
  const redis = await redisGetJson<{ payload: T; generatedAt: string }>(rKey);
  if (redis) {
    return { payload: redis.payload, generatedAt: redis.generatedAt, cached: true };
  }

  // Layer 2: Supabase
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from('cached_content')
      .select('payload, generated_at')
      .eq('google_sub', googleSub)
      .eq('content_type', contentType)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (data) {
      const item = { payload: data.payload as T, generatedAt: data.generated_at };
      // Backfill Redis
      const ttl = TTL[contentType] ?? 86_400;
      await redisSetJson(rKey, item, ttl);
      return { ...item, cached: true };
    }
  } catch {
    // No row or error — cache miss
  }

  return null;
}

/**
 * Store in both cache layers.
 */
export async function setCached<T>(
  googleSub: string,
  contentType: string,
  payload: T,
): Promise<void> {
  const now = new Date().toISOString();
  const ttl = TTL[contentType] ?? 86_400;
  const rKey = redisKey(googleSub, contentType);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // Redis
  await redisSetJson(rKey, { payload, generatedAt: now }, ttl);

  // Supabase
  try {
    const sb = getServiceSupabase();
    await sb.from('cached_content').upsert(
      {
        google_sub: googleSub,
        content_type: contentType,
        payload: payload as any,
        generated_at: now,
        expires_at: expiresAt,
      },
      { onConflict: 'google_sub,content_type' },
    );
  } catch (e) {
    console.error('[contentCache] Supabase upsert error:', e);
  }
}

/**
 * Invalidate a content type from both layers.
 */
export async function invalidateCached(
  googleSub: string,
  contentType: string,
): Promise<void> {
  await redisDel(redisKey(googleSub, contentType));
  try {
    const sb = getServiceSupabase();
    await sb
      .from('cached_content')
      .delete()
      .eq('google_sub', googleSub)
      .eq('content_type', contentType);
  } catch {
    // Best effort
  }
}

/**
 * Invalidate all cached content for a user (e.g. on location change).
 */
export async function invalidateAllCached(googleSub: string): Promise<void> {
  for (const type of Object.keys(TTL)) {
    await invalidateCached(googleSub, type);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/redisCache.ts src/lib/server/contentCache.ts
git commit -m "feat: add two-layer content cache (Redis + Supabase)"
```

---

### Task 2: Database Migrations

**Files:**
- Create: `supabase/008_cached_content.sql`
- Create: `supabase/009_location_updated_at.sql`

- [ ] **Step 1: Create cached_content table**

Create `supabase/008_cached_content.sql`:

```sql
-- Two-layer content cache: stores LLM-generated content to avoid recomputation.
CREATE TABLE IF NOT EXISTS cached_content (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT NOT NULL,
  content_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(google_sub, content_type)
);

CREATE INDEX IF NOT EXISTS idx_cached_content_lookup
  ON cached_content (google_sub, content_type)
  WHERE expires_at > NOW();
```

- [ ] **Step 2: Add location_updated_at column**

Create `supabase/009_location_updated_at.sql`:

```sql
-- Track when user last updated their location (30-day lock).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/008_cached_content.sql supabase/009_location_updated_at.sql
git commit -m "feat(db): add cached_content table and location_updated_at column"
```

---

### Task 3: Morning Brief API

**Files:**
- Create: `src/routes/api/home/morning-brief/+server.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/home/morning-brief/+server.ts`:

```typescript
/**
 * GET /api/home/morning-brief?sub={googleSub}
 *
 * Returns personalized news + suggested reads.
 * Cached for 24hr in Redis + Supabase. LLM only on cache miss.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCached, setCached } from '$lib/server/contentCache';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { searchWeb, formatResultsForAI } from '$lib/server/search';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  relevance: string;
}

interface ReadItem {
  title: string;
  author: string;
  type: string;
  why: string;
  url: string;
}

interface MorningBriefPayload {
  news: NewsItem[];
  reads: ReadItem[];
}

function timeGreeting(name: string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return `Good morning, ${name}`;
  if (h >= 12 && h < 17) return `Good afternoon, ${name}`;
  if (h >= 17 && h < 21) return `Good evening, ${name}`;
  return `Hey ${name}`;
}

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  // Check cache
  const cached = await getCached<MorningBriefPayload>(sub, 'morning_brief');
  if (cached) {
    return json({
      ok: true,
      greeting: timeGreeting(url.searchParams.get('name') || 'there'),
      ...cached.payload,
      cached: true,
      generatedAt: cached.generatedAt,
    });
  }

  // Cache miss — generate
  try {
    const graph = await resolveIdentityGraph(sub);
    if (!graph) return json({ ok: true, greeting: timeGreeting('there'), news: [], reads: [], cached: false });

    // Build search queries from identity
    const interests = (graph.activities || []).slice(0, 3);
    const city = graph.city || '';
    const role = graph.role || '';
    const genres = (graph.topGenres || []).slice(0, 2);

    const queries: string[] = [];
    if (role) queries.push(`${role} industry news ${new Date().toISOString().slice(0, 10)}`);
    if (interests.length) queries.push(`${interests.join(' ')} trends 2026`);
    if (city) queries.push(`${city} events things to do this week`);
    if (genres.length) queries.push(`${genres.join(' ')} new music releases`);
    if (!queries.length) queries.push('technology culture lifestyle news today');

    // Search
    const searchResults = await Promise.all(
      queries.slice(0, 3).map(q => searchWeb(q, 3))
    );
    const allResults = searchResults.flat();
    const formatted = formatResultsForAI(allResults);

    // Claude generates brief
    const identitySummary = graph.identitySummary || '';
    const archetype = (graph as any).archetype || '';

    const prompt = `You are generating a personalized morning brief for a user.

IDENTITY: ${identitySummary}
ARCHETYPE: ${archetype}
CITY: ${city}
ROLE: ${role}
INTERESTS: ${interests.join(', ')}

SEARCH RESULTS:
${formatted}

Generate a JSON response with:
1. "news": 3-4 most relevant news items from the search results. For each: headline, summary (1 sentence), source, url (copy verbatim from results), relevance (why this matters to THIS specific user based on their identity).
2. "reads": 2-3 book or article suggestions that would resonate with this person's archetype and interests. For each: title, author, type (book/article/podcast), why (1 sentence connecting to their identity), url (search result url or empty string).

Return ONLY valid JSON: { "news": [...], "reads": [...] }`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    let payload: MorningBriefPayload = { news: [], reads: [] };
    try {
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('[MorningBrief] Failed to parse Claude response');
    }

    // Cache the result
    await setCached(sub, 'morning_brief', payload);

    return json({
      ok: true,
      greeting: timeGreeting(url.searchParams.get('name') || 'there'),
      ...payload,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[MorningBrief] Error:', e.message);
    return json({ ok: true, greeting: timeGreeting('there'), news: [], reads: [], cached: false });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/home/morning-brief/+server.ts
git commit -m "feat(api): add GET /api/home/morning-brief with two-layer caching"
```

---

### Task 4: Artist Artwork Cache API

**Files:**
- Create: `src/routes/api/home/artist-artwork/+server.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/home/artist-artwork/+server.ts`:

```typescript
/**
 * GET /api/home/artist-artwork?artists=name1,name2,...
 *
 * Returns iTunes artwork URLs, cached in Redis for 30 days.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { redisGetJson, redisSetJson } from '$lib/server/redisCache';
import { getArtistArtwork, upscaleItunesArtworkUrl } from '$lib/client/itunesArtwork';

const REDIS_TTL = 2_592_000; // 30 days

export const GET: RequestHandler = async ({ url }) => {
  const raw = url.searchParams.get('artists') || '';
  const names = raw.split(',').map(n => n.trim()).filter(Boolean).slice(0, 10);
  if (!names.length) return json({ ok: true, artwork: {} });

  const result: Record<string, string> = {};

  await Promise.all(names.map(async (name) => {
    const rKey = `wagwan:artwork:${name.toLowerCase()}`;

    // Check Redis first
    const cached = await redisGetJson<string>(rKey);
    if (cached) {
      result[name] = cached;
      return;
    }

    // Fetch from iTunes
    const artUrl = await getArtistArtwork(name);
    if (artUrl) {
      result[name] = artUrl;
      await redisSetJson(rKey, artUrl, REDIS_TTL);
    }
  }));

  return json({ ok: true, artwork: result });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/home/artist-artwork/+server.ts
git commit -m "feat(api): add GET /api/home/artist-artwork with Redis caching"
```

---

### Task 5: Create Frontend Components (CalendarToday, MorningBrief, SuggestedReads)

**Files:**
- Create: `src/lib/components/home/CalendarToday.svelte`
- Create: `src/lib/components/home/MorningBrief.svelte`
- Create: `src/lib/components/home/SuggestedReads.svelte`

- [ ] **Step 1: Create CalendarToday.svelte**

Create `src/lib/components/home/CalendarToday.svelte`:

```svelte
<script lang="ts">
  export let events: { title: string; start: string; end?: string }[] = [];

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ''; }
  }

  const colors = ['#4D7CFF', '#FFB84D', '#FF4D4D', '#4D7CFF', '#FFB84D'];
</script>

{#if events.length}
  <div class="cal-strip">
    {#each events.slice(0, 4) as event, i}
      <div class="cal-event" style="border-left-color: {colors[i % colors.length]}">
        <span class="cal-time">{formatTime(event.start)}</span>
        <span class="cal-title">{event.title}</span>
      </div>
    {/each}
  </div>
{:else}
  <p class="cal-empty">No events today</p>
{/if}

<style>
  .cal-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .cal-strip::-webkit-scrollbar { display: none; }

  .cal-event {
    flex-shrink: 0;
    width: 200px;
    padding: 12px 14px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #4D7CFF;
    border-radius: 12px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
  }

  .cal-time {
    display: block;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .cal-title {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cal-empty {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    padding: 0 24px;
  }
</style>
```

- [ ] **Step 2: Create MorningBrief.svelte**

Create `src/lib/components/home/MorningBrief.svelte`:

```svelte
<script lang="ts">
  export let news: { headline: string; summary: string; source: string; url: string; relevance: string }[] = [];
</script>

{#if news.length}
  <div class="brief-list">
    {#each news as item}
      <a class="brief-card" href={item.url} target="_blank" rel="noopener">
        <div class="brief-top">
          <span class="brief-source">{item.source}</span>
          <span class="brief-relevance">{item.relevance}</span>
        </div>
        <h4 class="brief-headline">{item.headline}</h4>
        <p class="brief-summary">{item.summary}</p>
      </a>
    {/each}
  </div>
{/if}

<style>
  .brief-list { display: flex; flex-direction: column; gap: 12px; }

  .brief-card {
    display: block;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
    text-decoration: none;
    transition: transform 0.15s, border-color 0.15s;
  }
  .brief-card:hover {
    transform: translateY(-2px);
    border-color: rgba(77, 124, 255, 0.3);
  }

  .brief-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
    gap: 8px;
  }

  .brief-source {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-secondary, #4D7CFF);
  }

  .brief-relevance {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    text-align: right;
    flex-shrink: 1;
    min-width: 0;
  }

  .brief-headline {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px;
    line-height: 1.3;
  }

  .brief-summary {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }
</style>
```

- [ ] **Step 3: Create SuggestedReads.svelte**

Create `src/lib/components/home/SuggestedReads.svelte`:

```svelte
<script lang="ts">
  export let reads: { title: string; author: string; type: string; why: string; url: string }[] = [];

  const typeEmoji: Record<string, string> = {
    book: '📚',
    article: '📄',
    podcast: '🎙️',
  };
</script>

{#if reads.length}
  <div class="reads-strip">
    {#each reads as item}
      <a class="read-card" href={item.url || '#'} target="_blank" rel="noopener">
        <span class="read-type">{typeEmoji[item.type] || '📖'} {item.type}</span>
        <h4 class="read-title">{item.title}</h4>
        {#if item.author}<span class="read-author">{item.author}</span>{/if}
        <p class="read-why">{item.why}</p>
      </a>
    {/each}
  </div>
{/if}

<style>
  .reads-strip {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .reads-strip::-webkit-scrollbar { display: none; }

  .read-card {
    flex-shrink: 0;
    width: 240px;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.15s, border-color 0.15s;
  }
  .read-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 184, 77, 0.3);
  }

  .read-type {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-tertiary, #FFB84D);
  }

  .read-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
  }

  .read-author {
    font-size: 11px;
    color: var(--text-muted);
  }

  .read-why {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
    font-style: italic;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/home/CalendarToday.svelte src/lib/components/home/MorningBrief.svelte src/lib/components/home/SuggestedReads.svelte
git commit -m "feat(home): add CalendarToday, MorningBrief, SuggestedReads components"
```

---

### Task 6: Time-Aware Greeting in HeroIdentity

**Files:**
- Modify: `src/lib/components/home/HeroIdentity.svelte`

- [ ] **Step 1: Add greeting prop and time logic**

In the script block, add a new prop after the existing ones:

```typescript
  export let greeting = '';
```

- [ ] **Step 2: Display greeting above the kicker**

In the template, before the kicker `{#if kickerText}` block, add:

```svelte
    {#if greeting}
      <p class="greeting anim anim-0">{greeting}</p>
    {/if}
```

- [ ] **Step 3: Add greeting style**

In the `<style>` block, add:

```css
  .greeting {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.01em;
    margin: 0 0 8px;
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/home/HeroIdentity.svelte
git commit -m "feat(home): add time-aware greeting to HeroIdentity"
```

---

### Task 7: Enhance ArtistStrip with Real Artwork

**Files:**
- Modify: `src/lib/components/home/ArtistStrip.svelte`

- [ ] **Step 1: Add artwork fetching on mount**

In the script block, replace the entire content with:

```typescript
  import { onMount } from 'svelte';

  export let artists: { name: string; image?: string }[] = [];

  let artworkMap: Record<string, string> = {};

  function initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  const gradients = [
    'linear-gradient(135deg, #FF4D4D, #FFB84D)',
    'linear-gradient(135deg, #4D7CFF, #FF4D4D)',
    'linear-gradient(135deg, #FFB84D, #4D7CFF)',
    'linear-gradient(135deg, #FF4D4D, #4D7CFF)',
    'linear-gradient(135deg, #4D7CFF, #FFB84D)',
    'linear-gradient(135deg, #FFB84D, #FF4D4D)',
  ];

  onMount(async () => {
    const names = artists.map(a => a.name).filter(Boolean);
    if (!names.length) return;
    try {
      const res = await fetch(`/api/home/artist-artwork?artists=${encodeURIComponent(names.join(','))}`);
      const data = await res.json();
      if (data.artwork) artworkMap = data.artwork;
    } catch {
      // Fallback to gradient avatars
    }
  });

  $: resolvedArtists = artists.slice(0, 8).map(a => ({
    ...a,
    resolvedImage: a.image || artworkMap[a.name] || '',
  }));
```

- [ ] **Step 2: Update template to use resolvedArtists**

Replace the template:

```svelte
<div class="artist-strip">
  {#each resolvedArtists as artist, i}
    <div class="artist-item">
      {#if artist.resolvedImage}
        <img class="artist-img" src={artist.resolvedImage} alt={artist.name} />
      {:else}
        <div class="artist-fallback" style="background:{gradients[i % gradients.length]}">
          <span>{initial(artist.name)}</span>
        </div>
      {/if}
      <span class="artist-name">{artist.name}</span>
    </div>
  {/each}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/home/ArtistStrip.svelte
git commit -m "feat(home): fetch real artist artwork from iTunes API in ArtistStrip"
```

---

### Task 8: Add Location to Onboarding + Profile Store

**Files:**
- Modify: `src/lib/stores/profile.ts`
- Modify: `src/routes/onboarding/+page.svelte`

- [ ] **Step 1: Add locationUpdatedAt to UserProfile**

In `src/lib/stores/profile.ts`, add `locationUpdatedAt: string;` to the `UserProfile` interface after `profileUpdatedAt`. Also add `locationUpdatedAt: '',` to `DEFAULT_PROFILE`.

- [ ] **Step 2: Add location input to onboarding Step 0**

In `src/routes/onboarding/+page.svelte`, in the Step 0 phone input section (inside `{#if !wagwanOtpSent}`), after the `.ob-unlock-card` div and before `<div class="ob-bottom">`, add:

```svelte
        <div class="ob-location-field">
          <input
            type="text"
            bind:value={manualCity}
            placeholder="Your city (e.g. Mumbai, New York)"
            class="ob-input"
            style="font-family: var(--font-sans); font-size: 14px; letter-spacing: 0;"
          />
          <span class="ob-location-hint">Used for local recommendations. Optional.</span>
        </div>
```

- [ ] **Step 3: Add location hint style**

In the `<style>` block, after the unlock card styles, add:

```css
  .ob-location-field {
    margin-top: 16px;
  }
  .ob-location-hint {
    font-size: 11px;
    color: var(--text-muted);
    display: block;
    margin-top: 6px;
  }
```

- [ ] **Step 4: Set locationUpdatedAt in finish function**

In the `finish()` function, when building `fullProfile`, add `locationUpdatedAt: manualCity ? new Date().toISOString() : '',` alongside the other fields.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/profile.ts src/routes/onboarding/+page.svelte
git commit -m "feat: add location input to onboarding Step 0 with monthly lock tracking"
```

---

### Task 9: Wire Everything into the Home Page

**Files:**
- Modify: `src/routes/(app)/home/+page.svelte`

- [ ] **Step 1: Add imports**

Add after existing home component imports:

```typescript
  import CalendarToday from '$lib/components/home/CalendarToday.svelte';
  import MorningBrief from '$lib/components/home/MorningBrief.svelte';
  import SuggestedReads from '$lib/components/home/SuggestedReads.svelte';
```

- [ ] **Step 2: Add data variables**

After the existing hero data reactive declarations, add:

```typescript
  // ── Morning page data ──
  let calendarEvents: { title: string; start: string; end?: string }[] = [];
  let morningNews: { headline: string; summary: string; source: string; url: string; relevance: string }[] = [];
  let morningReads: { title: string; author: string; type: string; why: string; url: string }[] = [];
  let morningGreeting = '';
  let briefLoading = false;
```

- [ ] **Step 3: Add greeting computation**

Add a reactive block:

```typescript
  $: {
    const h = new Date().getHours();
    const name = firstName || 'there';
    if (h >= 5 && h < 12) morningGreeting = `Good morning, ${name}`;
    else if (h >= 12 && h < 17) morningGreeting = `Good afternoon, ${name}`;
    else if (h >= 17 && h < 21) morningGreeting = `Good evening, ${name}`;
    else morningGreeting = `Hey ${name}`;
  }
```

- [ ] **Step 4: Add fetch calls in onMount**

In the existing `onMount` block (or the appropriate data-loading function), add after the persona fetch:

```typescript
    // Fetch morning brief
    if (sub) {
      briefLoading = true;
      fetch(`/api/home/morning-brief?sub=${encodeURIComponent(sub)}&name=${encodeURIComponent(firstName)}`)
        .then(r => r.json())
        .then(data => {
          if (data.news) morningNews = data.news;
          if (data.reads) morningReads = data.reads;
          if (data.greeting) morningGreeting = data.greeting;
        })
        .catch(() => {})
        .finally(() => { briefLoading = false; });
    }

    // Fetch calendar
    const googleToken = $profile.googleAccessToken;
    if (googleToken) {
      fetch('/api/google/calendar', { headers: { 'x-google-token': googleToken } })
        .then(r => r.json())
        .then(data => { calendarEvents = data.events || []; })
        .catch(() => {});
    }
```

- [ ] **Step 5: Pass greeting to HeroIdentity**

In the `<HeroIdentity` component usage, add:

```
          greeting={morningGreeting}
```

- [ ] **Step 6: Add new sections to the template**

In the identity column, after the HeroIdentity component and before the existing music narrative section, add:

```svelte
          <!-- ── 📅 Today ── -->
          {#if calendarEvents.length || $profile.googleConnected}
            <NarrativeSection emoji="📅" label="Today">
              <div class="narrative-card" style="width:100%;">
                <CalendarToday events={calendarEvents} />
              </div>
            </NarrativeSection>
          {/if}
```

After the "How You Listen" section and before "How You Show Up", add:

```svelte
          <!-- ── 📰 Your Brief ── -->
          {#if morningNews.length}
            <NarrativeSection emoji="📰" label="Your Brief" vertical>
              <MorningBrief news={morningNews} />
            </NarrativeSection>
          {/if}

          <!-- ── 📚 Reads For You ── -->
          {#if morningReads.length}
            <NarrativeSection emoji="📚" label="Reads For You">
              <SuggestedReads reads={morningReads} />
            </NarrativeSection>
          {/if}
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/\(app\)/home/+page.svelte
git commit -m "feat(home): wire calendar, morning brief, reads, and greeting into home page"
```

---

### Task 10: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "^[0-9]+ (ERROR|COMPLETED)" | tail -10
```

Expected: No new errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Apply migrations**

Run in Supabase SQL Editor:
- `supabase/008_cached_content.sql`
- `supabase/009_location_updated_at.sql`

- [ ] **Step 4: Test**

```bash
npm run dev
```

Test:
1. Home page shows time-aware greeting
2. Calendar events display if Google is connected
3. Artist images load from iTunes API
4. Morning brief loads with personalized news + reads (may take a few seconds on first load, instant on refresh)
5. Onboarding Step 0 shows location input field

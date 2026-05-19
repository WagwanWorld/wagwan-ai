# Content Automation — Auto-Post Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Content Automation tab to the brand portal with AI-powered content generation, calendar scheduling, and bulk cadence mode.

**Architecture:** New `ContentAutomation.svelte` container with sub-components (pipeline stepper, upload zone, AI review cards, calendar, bulk cadence wizard, activity feed). New API endpoints for AI content generation (`/api/brand/generate-post-content`), bulk scheduling (`/api/brand/schedule-bulk`), and activity feed (`/api/brand/activity-feed`). Upgrades the publish cron from daily to every 15 minutes with token refresh.

**Tech Stack:** SvelteKit, Supabase (PostgreSQL), Anthropic Claude SDK (`claude-sonnet-4-6`), existing GCS upload + Meta Graph API, glass design system tokens.

**Spec:** `docs/superpowers/specs/2026-04-28-content-automation-scheduler-design.md`

---

## File Map

### New Files — Components

| File                                                      | Responsibility                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/components/brands/ContentAutomation.svelte`      | Container — manages pipeline state machine, orchestrates sub-components              |
| `src/lib/components/brands/ContentPipelineStepper.svelte` | Horizontal step indicator (Upload → Generate → Review → Schedule → Post)             |
| `src/lib/components/brands/PostReviewCard.svelte`         | AI-generated post review/edit card (caption, hashtags, mentions, location, schedule) |
| `src/lib/components/brands/ScheduleCalendar.svelte`       | Week/month calendar view with post cards, drag-to-reschedule                         |
| `src/lib/components/brands/BulkCadenceWizard.svelte`      | Multi-asset strip + rhythm config + preview timeline                                 |
| `src/lib/components/brands/ActivityFeed.svelte`           | Right sidebar with timestamped event stream                                          |

### New Files — API

| File                                                    | Responsibility                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/routes/api/brand/generate-post-content/+server.ts` | Claude-powered caption/hashtag/mention/alt-text generation per asset |
| `src/routes/api/brand/schedule-bulk/+server.ts`         | Batch schedule with cadence computation                              |
| `src/routes/api/brand/activity-feed/+server.ts`         | GET recent activity events                                           |

### New Files — Database

| File                                                          | Responsibility                                      |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `supabase/migrations/20260428000000_content_activity_log.sql` | `content_activity_log` table + `brand_voice` column |

### Modified Files

| File                                               | Change                                                          |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `src/routes/brands/+layout.svelte`                 | Add "Content Automation" nav pill (03), shift Profile to 04     |
| `src/routes/brands/portal/+page.svelte`            | Add `automation` tab type, render `ContentAutomation` component |
| `src/routes/api/cron/publish-scheduled/+server.ts` | Remove 5-post limit, add token refresh before publish           |
| `src/routes/api/brand/publish-now/+server.ts`      | Allow retrying `failed` posts                                   |
| `vercel.json`                                      | Change publish-scheduled cron to `*/15 * * * *`                 |

---

### Task 1: Database Migration — Activity Log & Brand Voice

**Files:**

- Create: `supabase/migrations/20260428000000_content_activity_log.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Content activity log for tracking all automation events
CREATE TABLE IF NOT EXISTS content_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'uploaded', 'generated', 'scheduled', 'published', 'failed', 'retried', 'rescheduled'
  )),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_brand ON content_activity_log(brand_ig_id, created_at DESC);

-- Brand voice preference for AI content generation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_accounts' AND column_name = 'brand_voice'
  ) THEN
    ALTER TABLE brand_accounts
      ADD COLUMN brand_voice TEXT DEFAULT 'Bold'
      CHECK (brand_voice IN ('Bold', 'Playful', 'Premium', 'Minimal', 'Hype'));
  END IF;
END $$;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` or apply via the Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428000000_content_activity_log.sql
git commit -m "feat(db): add content_activity_log table and brand_voice column"
```

---

### Task 2: Activity Feed API Endpoint

**Files:**

- Create: `src/routes/api/brand/activity-feed/+server.ts`

- [ ] **Step 1: Create the activity feed GET endpoint**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100);

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/content_activity_log?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw error(500, `Database error: ${errText}`);
  }

  const events = await res.json();
  return json({ ok: true, events });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/brand/activity-feed/+server.ts
git commit -m "feat(api): add activity feed endpoint"
```

---

### Task 3: AI Content Generation Endpoint

**Files:**

- Create: `src/routes/api/brand/generate-post-content/+server.ts`

- [ ] **Step 1: Create the generate-post-content endpoint**

This endpoint takes uploaded asset URLs and generates captions, hashtags, mentions, alt text, and location using Claude. It pulls brand context from `brand_accounts`, `brand_snapshots`, and `content_pillars`.

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || '' });

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { assets, context } = body as {
    assets: Array<{ gcsUrl: string; mediaType: string; fileName?: string }>;
    context?: string;
  };
  if (!assets?.length) throw error(400, 'No assets provided');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  // Fetch brand profile + voice
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${igUserId}&select=ig_username,ig_name,ig_followers_count,brand_identity,brand_voice&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brandRows = await brandRes.json();
  const brand = brandRows[0];
  if (!brand) throw error(404, 'Brand not found');

  // Fetch brand snapshot for pillars + audience
  const snapRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${igUserId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const snapRows = snapRes.ok ? await snapRes.json() : [];
  const intelligence = snapRows[0]?.intelligence || {};

  // Fetch recent post performance for hashtag/content patterns
  const postsRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_fingerprints?brand_ig_id=eq.${igUserId}&order=posted_at.desc&limit=10&select=caption,hashtags,hook_archetype,engagement_score`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const recentFingerprints = postsRes.ok ? await postsRes.json() : [];

  const brandVoice = brand.brand_voice || 'Bold';
  const identity = brand.brand_identity || {};
  const pillars = intelligence.contentPillars || [];
  const audience = intelligence.audiencePersonas || [];
  const topHashtags = recentFingerprints
    .flatMap((p: Record<string, unknown>) => (p.hashtags as string[]) || [])
    .reduce((acc: Record<string, number>, h: string) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {});
  const sortedHashtags = Object.entries(topHashtags)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 15)
    .map(([h]) => h);

  // Build prompt parts with images for vision
  const contentParts: Anthropic.Messages.ContentBlockParam[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.mediaType === 'IMAGE' || asset.mediaType === 'CAROUSEL') {
      try {
        const imgRes = await fetch(asset.gcsUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          contentParts.push({
            type: 'text',
            text: `Asset ${i + 1} (${asset.fileName || 'image'}):`,
          });
          contentParts.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          });
        } else {
          contentParts.push({
            type: 'text',
            text: `Asset ${i + 1}: ${asset.fileName || 'image'} (could not load for vision)`,
          });
        }
      } catch {
        contentParts.push({
          type: 'text',
          text: `Asset ${i + 1}: ${asset.fileName || 'image'} (could not load)`,
        });
      }
    } else {
      contentParts.push({
        type: 'text',
        text: `Asset ${i + 1}: ${asset.fileName || 'video'} (${asset.mediaType}) — generate based on filename and brand context`,
      });
    }
  }

  contentParts.push({
    type: 'text',
    text: `You are a social media content writer for @${brand.ig_username} (${brand.ig_name}, ${brand.ig_followers_count} followers).

BRAND VOICE: ${brandVoice}
${identity.bio ? `BIO: ${identity.bio}` : ''}
${pillars.length ? `CONTENT PILLARS: ${pillars.join(', ')}` : ''}
${audience.length ? `AUDIENCE: ${audience.map((a: Record<string, string>) => a.name || a.label).join(', ')}` : ''}
${sortedHashtags.length ? `BRAND'S TOP HASHTAGS: ${sortedHashtags.join(', ')}` : ''}
${context ? `USER CONTEXT: ${context}` : ''}

For each asset above, generate:
1. **caption**: On-brand copy in the ${brandVoice} voice. Max 2200 chars. Include a CTA.
   - For Reels: hook-first copy (grab attention in first line)
   - For Carousels: reference the multi-slide format
   - For Posts: engagement-focused with CTA
   - For Stories: short, casual, conversational
2. **hashtags**: Array of 8-15 hashtags. Mix branded tags and trending/topical tags. No # prefix.
3. **mentions**: Array of @handles to tag (from brand context, collaborators). No @ prefix.
4. **location**: Suggested location tag based on brand profile or content.
5. **altText**: Accessibility description of the visual (1-2 sentences).
6. **postType**: Best format — one of IMAGE, VIDEO, REELS, STORIES, CAROUSEL.

Respond as a JSON array, one object per asset:
[{ "caption": "...", "hashtags": [...], "mentions": [...], "location": "...", "altText": "...", "postType": "..." }]

JSON only, no markdown.`,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentParts }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let results;
  try {
    results = JSON.parse(text);
  } catch {
    throw error(500, 'AI returned invalid JSON');
  }

  // Merge gcsUrl back into results
  const merged = assets.map((asset, i) => ({
    gcsUrl: asset.gcsUrl,
    mediaType: asset.mediaType,
    fileName: asset.fileName,
    ...results[i],
  }));

  // Log activity
  for (const asset of merged) {
    await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        event_type: 'generated',
        event_data: { gcsUrl: asset.gcsUrl, postType: asset.postType },
      }),
    });
  }

  return json({ ok: true, results: merged, brandVoice });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/brand/generate-post-content/+server.ts
git commit -m "feat(api): add AI content generation endpoint"
```

---

### Task 4: Bulk Schedule Endpoint

**Files:**

- Create: `src/routes/api/brand/schedule-bulk/+server.ts`

- [ ] **Step 1: Create the bulk schedule endpoint**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { posts, cadence } = body as {
    posts: Array<{
      gcsUrl: string;
      mediaType: string;
      caption: string;
      hashtags: string[];
      altText?: string;
      mentions?: string[];
      location?: string;
      carouselItems?: Array<{ gcsUrl: string; mediaType: string; position: number }>;
    }>;
    cadence: {
      frequency: 'daily' | 'twice_daily' | 'every_2_days' | 'custom';
      startDate: string; // YYYY-MM-DD
      time: string; // HH:mm
      timezone: string; // IANA timezone
      customIntervalHours?: number;
    };
  };

  if (!posts?.length) throw error(400, 'No posts provided');
  if (!cadence) throw error(400, 'Cadence config required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  // Compute scheduled_at for each post based on cadence
  const intervalMs = {
    daily: 24 * 60 * 60 * 1000,
    twice_daily: 12 * 60 * 60 * 1000,
    every_2_days: 48 * 60 * 60 * 1000,
    custom: (cadence.customIntervalHours || 24) * 60 * 60 * 1000,
  }[cadence.frequency];

  // Build the start timestamp in the user's timezone
  // The client sends date + time + timezone, we construct the ISO string
  const startIso = `${cadence.startDate}T${cadence.time}:00`;

  const scheduled = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const offsetMs = i * intervalMs;
    const baseDate = new Date(startIso);
    const scheduledAt = new Date(baseDate.getTime() + offsetMs).toISOString();

    // Insert main post
    const postRes = await fetch(`${supabaseUrl}/rest/v1/scheduled_posts`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        gcs_url: post.gcsUrl,
        media_type: post.mediaType,
        caption: post.caption,
        hashtags: post.hashtags,
        alt_text: post.altText || '',
        scheduled_at: scheduledAt,
        status: 'scheduled',
        ai_reasoning: `Bulk cadence: ${cadence.frequency}, position ${i + 1} of ${posts.length}`,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw error(500, `Database error: ${errText}`);
    }

    const [inserted] = await postRes.json();

    // Insert carousel items if present
    if (post.carouselItems?.length) {
      for (const item of post.carouselItems) {
        await fetch(`${supabaseUrl}/rest/v1/scheduled_post_carousel_items`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: inserted.id,
            gcs_url: item.gcsUrl,
            media_type: item.mediaType,
            position: item.position,
          }),
        });
      }
    }

    scheduled.push({
      postId: inserted.id,
      scheduledAt,
      gcsUrl: post.gcsUrl,
      caption: post.caption,
    });

    // Log activity
    await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        event_type: 'scheduled',
        event_data: { postId: inserted.id, scheduledAt, cadence: cadence.frequency },
      }),
    });
  }

  return json({ ok: true, scheduled });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/brand/schedule-bulk/+server.ts
git commit -m "feat(api): add bulk schedule endpoint with cadence computation"
```

---

### Task 5: Upgrade Cron — Frequency, Token Refresh, Activity Logging

**Files:**

- Modify: `src/routes/api/cron/publish-scheduled/+server.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json cron schedule**

In `vercel.json`, change the publish-scheduled cron from `"0 9 * * *"` to `"*/15 * * * *"`:

```json
{
  "path": "/api/cron/publish-scheduled",
  "schedule": "*/15 * * * *"
}
```

- [ ] **Step 2: Update the cron endpoint**

Replace the contents of `src/routes/api/cron/publish-scheduled/+server.ts` with the upgraded version that:

- Removes the `limit=5` cap (processes all due posts)
- Checks token expiry and refreshes if within 7 days
- Logs activity events on publish/fail

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';
import { refreshBrandToken } from '$lib/server/marketplace/brandInstagram';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Find ALL posts due for publishing (no limit)
  const duePostsRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&order=scheduled_at.asc`,
    { headers },
  );

  if (!duePostsRes.ok) {
    return json({ error: 'Failed to fetch due posts' }, { status: 500 });
  }

  const duePosts: Array<Record<string, unknown>> = await duePostsRes.json();
  const results = [];

  // Cache brand tokens to avoid repeated lookups
  const brandTokenCache = new Map<string, string>();

  for (const post of duePosts) {
    const brandIgId = post.brand_ig_id as string;

    // Get or cache brand token
    if (!brandTokenCache.has(brandIgId)) {
      const brandRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}&select=ig_access_token,token_expires_at&limit=1`,
        { headers },
      );
      const brandRows = brandRes.ok ? await brandRes.json() : [];
      const brandAccount = brandRows[0];

      if (!brandAccount) {
        results.push({ id: post.id, status: 'failed', error: 'Brand account not found' });
        // Log failure
        await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            brand_ig_id: brandIgId,
            event_type: 'failed',
            event_data: { postId: post.id, error: 'Brand account not found' },
          }),
        });
        continue;
      }

      let token = brandAccount.ig_access_token as string;

      // Refresh token if expiring within 7 days
      if (brandAccount.token_expires_at) {
        const expiresAt = new Date(brandAccount.token_expires_at as string);
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (expiresAt < sevenDaysFromNow) {
          try {
            const refreshed = await refreshBrandToken(token);
            token = refreshed.token;
            // Update token in DB
            await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                ig_access_token: refreshed.token,
                token_expires_at: refreshed.expiresAt.toISOString(),
              }),
            });
          } catch (e) {
            // Log token refresh failure but continue with existing token
            await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                brand_ig_id: brandIgId,
                event_type: 'failed',
                event_data: {
                  error: 'Token refresh failed',
                  detail: e instanceof Error ? e.message : 'unknown',
                },
              }),
            });
          }
        }
      }

      brandTokenCache.set(brandIgId, token);
    }

    const igAccessToken = brandTokenCache.get(brandIgId)!;

    // Mark as publishing
    await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'publishing' }),
    });

    // Fetch carousel items if needed
    let carouselItems: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }> | undefined;
    if (post.media_type === 'CAROUSEL') {
      const carouselRes = await fetch(
        `${supabaseUrl}/rest/v1/scheduled_post_carousel_items?post_id=eq.${post.id}&select=gcs_url,media_type&order=position.asc`,
        { headers },
      );
      const carouselRows: Array<{ gcs_url: string; media_type: string }> = carouselRes.ok
        ? await carouselRes.json()
        : [];
      carouselItems = carouselRows.map((r) => ({
        url: r.gcs_url,
        mediaType: r.media_type as 'IMAGE' | 'VIDEO',
      }));
    }

    const caption = [
      post.caption,
      ...((post.hashtags as string[]) || []).map((h: string) => `#${h}`),
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await publishPost(brandIgId, igAccessToken, {
      gcsUrl: post.gcs_url as string,
      mediaType: post.media_type as string,
      caption,
      altText: (post.alt_text as string) || undefined,
      carouselItems,
    });

    if (result.success) {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'published',
          published_at: new Date().toISOString(),
          ig_media_id: result.igMediaId,
          ig_permalink: result.permalink,
        }),
      });
      // Log success
      await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand_ig_id: brandIgId,
          event_type: 'published',
          event_data: { postId: post.id, igMediaId: result.igMediaId, permalink: result.permalink },
        }),
      });
      results.push({ id: post.id, status: 'published' });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'failed', error_message: result.error }),
      });
      // Log failure
      await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand_ig_id: brandIgId,
          event_type: 'failed',
          event_data: { postId: post.id, error: result.error },
        }),
      });
      results.push({ id: post.id, status: 'failed', error: result.error });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json src/routes/api/cron/publish-scheduled/+server.ts
git commit -m "feat(cron): upgrade publish cron to 15min with token refresh and activity logging"
```

---

### Task 6: Allow Retry on Failed Posts

**Files:**

- Modify: `src/routes/api/brand/publish-now/+server.ts`

- [ ] **Step 1: Update publish-now to accept failed posts and log activity**

Add retry support by allowing `failed` status posts to be re-published. After the existing line that fetches the post (line 25: `const post = posts[0];`), add a status check that allows both `scheduled` and `failed`:

```typescript
// After line 25: const post = posts[0];
// Add status check allowing retry of failed posts
if (post.status !== 'scheduled' && post.status !== 'failed') {
  throw error(400, `Post cannot be published — current status: ${post.status}`);
}
```

Then after the success/failure PATCH calls (after the existing `return json(...)` lines), add activity logging. At the end of the success branch (after line 79's `return json`), and the failure branch (after line 86's `return json`):

Replace the entire success block (lines 68-79) with:

```typescript
if (result.success) {
  await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: result.igMediaId,
      ig_permalink: result.permalink,
      error_message: null,
    }),
  });
  // Log activity
  await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      event_type: post.status === 'failed' ? 'retried' : 'published',
      event_data: { postId, igMediaId: result.igMediaId, permalink: result.permalink },
    }),
  });
  return json({ ok: true, igMediaId: result.igMediaId, permalink: result.permalink });
} else {
  await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'failed', error_message: result.error }),
  });
  await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      event_type: 'failed',
      event_data: { postId, error: result.error },
    }),
  });
  return json({ ok: false, error: result.error }, { status: 500 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/brand/publish-now/+server.ts
git commit -m "feat(api): allow retry of failed posts and add activity logging"
```

---

### Task 7: Pipeline Stepper Component

**Files:**

- Create: `src/lib/components/brands/ContentPipelineStepper.svelte`

- [ ] **Step 1: Create the stepper component**

```svelte
<script lang="ts">
  export let currentStep: 'upload' | 'generate' | 'review' | 'schedule' | 'post' = 'upload';

  const steps = [
    { id: 'upload', label: 'Upload', num: '1' },
    { id: 'generate', label: 'Generate', num: '2' },
    { id: 'review', label: 'Review', num: '3' },
    { id: 'schedule', label: 'Schedule', num: '4' },
    { id: 'post', label: 'Post', num: '5' },
  ] as const;

  $: currentIdx = steps.findIndex((s) => s.id === currentStep);

  function stepState(idx: number): 'done' | 'active' | 'inactive' {
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'active';
    return 'inactive';
  }
</script>

<div class="ca-stepper">
  {#each steps as step, i}
    {#if i > 0}
      <div class="ca-step-connector" class:ca-step-connector--done={i <= currentIdx}></div>
    {/if}
    <div class="ca-step">
      <div class="ca-step-num ca-step-num--{stepState(i)}">
        {#if stepState(i) === 'done'}&#10003;{:else}{step.num}{/if}
      </div>
      <span class="ca-step-label ca-step-label--{stepState(i)}">{step.label}</span>
    </div>
  {/each}
</div>

<style>
  .ca-stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 0;
    margin-bottom: 16px;
  }
  .ca-step {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ca-step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .ca-step-num--active {
    background: rgba(232, 70, 74, 0.15);
    border: 1.5px solid rgba(232, 70, 74, 0.5);
    color: #e8464a;
  }
  .ca-step-num--inactive {
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    color: #4a4a50;
  }
  .ca-step-num--done {
    background: rgba(74, 222, 128, 0.1);
    border: 1.5px solid rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }
  .ca-step-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: color 0.2s ease;
  }
  .ca-step-label--active {
    color: #e8464a;
  }
  .ca-step-label--inactive {
    color: #4a4a50;
  }
  .ca-step-label--done {
    color: #4ade80;
  }
  .ca-step-connector {
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 10px;
    transition: background 0.2s ease;
  }
  .ca-step-connector--done {
    background: rgba(74, 222, 128, 0.3);
  }

  @media (max-width: 640px) {
    .ca-step-label {
      display: none;
    }
    .ca-step-connector {
      width: 20px;
      margin: 0 4px;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/ContentPipelineStepper.svelte
git commit -m "feat(ui): add ContentPipelineStepper component"
```

---

### Task 8: Activity Feed Component

**Files:**

- Create: `src/lib/components/brands/ActivityFeed.svelte`

- [ ] **Step 1: Create the activity feed component**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface ActivityEvent {
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
  }

  let events: ActivityEvent[] = [];
  let loading = true;
  let pollInterval: ReturnType<typeof setInterval>;

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  function eventLabel(e: ActivityEvent): string {
    const data = e.event_data;
    switch (e.event_type) {
      case 'uploaded':
        return `Asset uploaded`;
      case 'generated':
        return `AI content generated`;
      case 'scheduled':
        return `Post scheduled${data.cadence ? ` (${data.cadence})` : ''}`;
      case 'published':
        return `Published to Instagram`;
      case 'failed':
        return `Post failed: ${(data.error as string)?.slice(0, 60) || 'unknown error'}`;
      case 'retried':
        return `Post retried and published`;
      case 'rescheduled':
        return `Post rescheduled`;
      default:
        return e.event_type;
    }
  }

  function eventColor(type: string): string {
    switch (type) {
      case 'published':
      case 'retried':
        return '#7fc8a9';
      case 'failed':
        return '#f87171';
      case 'scheduled':
      case 'rescheduled':
        return '#e8464a';
      default:
        return '#4A4A50';
    }
  }

  async function loadEvents() {
    try {
      const res = await fetch('/api/brand/activity-feed?limit=30', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        events = data.events || [];
      }
    } catch {
      // Silently fail — feed is non-critical
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadEvents();
    pollInterval = setInterval(loadEvents, 30000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<aside class="ca-feed">
  <span class="ca-feed-label">ACTIVITY</span>
  {#if loading}
    <div class="ca-feed-empty">Loading...</div>
  {:else if events.length === 0}
    <div class="ca-feed-empty">No activity yet</div>
  {:else}
    <div class="ca-feed-list">
      {#each events as event}
        <div class="ca-feed-item">
          <div class="ca-feed-dot" style="background:{eventColor(event.event_type)}"></div>
          <div class="ca-feed-content">
            <span class="ca-feed-time">{formatTime(event.created_at)}</span>
            <span class="ca-feed-text">{eventLabel(event)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .ca-feed {
    width: 260px;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .ca-feed-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    display: block;
    margin-bottom: 12px;
  }
  .ca-feed-empty {
    font-size: 12px;
    color: #4a4a50;
  }
  .ca-feed-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ca-feed-item {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.025);
    align-items: flex-start;
  }
  .ca-feed-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }
  .ca-feed-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .ca-feed-time {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #3a3a40;
    letter-spacing: 0.05em;
  }
  .ca-feed-text {
    font-size: 12px;
    color: #8a8a90;
    line-height: 1.4;
  }

  @media (max-width: 1024px) {
    .ca-feed {
      display: none;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/ActivityFeed.svelte
git commit -m "feat(ui): add ActivityFeed sidebar component"
```

---

### Task 9: Post Review Card Component

**Files:**

- Create: `src/lib/components/brands/PostReviewCard.svelte`

- [ ] **Step 1: Create the post review card**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let asset: {
    gcsUrl: string;
    mediaType: string;
    fileName?: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    location: string;
    altText: string;
    postType: string;
  };
  export let index: number = 0;
  export let total: number = 1;

  const dispatch = createEventDispatcher<{
    schedule: { asset: typeof asset; scheduledAt: string };
    regenerate: { index: number };
    publishNow: { asset: typeof asset };
  }>();

  let editCaption = asset.caption;
  let editHashtags = [...asset.hashtags];
  let editMentions = [...asset.mentions];
  let editLocation = asset.location;
  let editPostType = asset.postType;
  let scheduleDate = new Date().toISOString().split('T')[0];
  let scheduleTime = '09:00';
  let newHashtag = '';
  let newMention = '';

  $: charCount = editCaption.length;

  function removeHashtag(idx: number) {
    editHashtags = editHashtags.filter((_, i) => i !== idx);
  }
  function addHashtag() {
    if (newHashtag.trim()) {
      editHashtags = [...editHashtags, newHashtag.trim().replace(/^#/, '')];
      newHashtag = '';
    }
  }
  function removeMention(idx: number) {
    editMentions = editMentions.filter((_, i) => i !== idx);
  }
  function addMention() {
    if (newMention.trim()) {
      editMentions = [...editMentions, newMention.trim().replace(/^@/, '')];
      newMention = '';
    }
  }

  function handleSchedule() {
    const updated = {
      ...asset,
      caption: editCaption,
      hashtags: editHashtags,
      mentions: editMentions,
      location: editLocation,
      postType: editPostType,
    };
    dispatch('schedule', { asset: updated, scheduledAt: `${scheduleDate}T${scheduleTime}:00` });
  }
</script>

<div class="prc">
  <!-- Header -->
  <div class="prc-header">
    <span class="prc-label">REVIEW — POST {index + 1} OF {total}</span>
    <div class="prc-dots">
      {#each Array(total) as _, i}
        <span class="prc-dot" class:prc-dot--active={i === index}></span>
      {/each}
    </div>
  </div>

  <div class="prc-body">
    <!-- Media preview -->
    <div class="prc-media">
      <div class="prc-preview">
        {#if asset.mediaType === 'IMAGE' || asset.mediaType === 'CAROUSEL'}
          <img src={asset.gcsUrl} alt={asset.altText || 'Preview'} class="prc-img" />
        {:else}
          <div class="prc-video-placeholder">&#127916; Video</div>
        {/if}
      </div>
      <div class="prc-type-pills">
        {#each ['IMAGE', 'STORIES', 'REELS', 'CAROUSEL'] as t}
          <button
            class="prc-type-pill"
            class:prc-type-pill--active={editPostType === t}
            on:click={() => (editPostType = t)}
            >{t === 'IMAGE'
              ? 'Post'
              : t === 'STORIES'
                ? 'Story'
                : t === 'REELS'
                  ? 'Reel'
                  : 'Carousel'}</button
          >
        {/each}
      </div>
    </div>

    <!-- Fields -->
    <div class="prc-fields">
      <!-- Caption -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">CAPTION</span>
          <span class="prc-field-meta">AI GENERATED · {charCount} / 2,200</span>
        </div>
        <textarea class="prc-caption" bind:value={editCaption} rows="4" maxlength="2200"></textarea>
      </div>

      <!-- Hashtags -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">HASHTAGS</span>
          <span class="prc-field-meta">{editHashtags.length} TAGS</span>
        </div>
        <div class="prc-tags">
          {#each editHashtags as tag, i}
            <button class="prc-tag prc-tag--blue" on:click={() => removeHashtag(i)}>#{tag} ×</button
            >
          {/each}
          <form class="prc-tag-add" on:submit|preventDefault={addHashtag}>
            <input class="prc-tag-input" bind:value={newHashtag} placeholder="+ add" />
          </form>
        </div>
      </div>

      <!-- Mentions -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">MENTIONS</span>
        </div>
        <div class="prc-tags">
          {#each editMentions as mention, i}
            <button class="prc-tag prc-tag--purple" on:click={() => removeMention(i)}
              >@{mention} ×</button
            >
          {/each}
          <form class="prc-tag-add" on:submit|preventDefault={addMention}>
            <input class="prc-tag-input" bind:value={newMention} placeholder="+ add" />
          </form>
        </div>
      </div>

      <!-- Location -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">LOCATION</span>
        </div>
        <input class="prc-location-input" bind:value={editLocation} placeholder="Location..." />
      </div>

      <!-- Schedule -->
      <div class="prc-field">
        <div class="prc-field-header">
          <span class="prc-field-label">SCHEDULE</span>
        </div>
        <div class="prc-schedule-row">
          <input type="date" class="prc-schedule-input" bind:value={scheduleDate} />
          <input type="time" class="prc-schedule-input" bind:value={scheduleTime} />
        </div>
      </div>

      <!-- Actions -->
      <div class="prc-actions">
        <button class="prc-btn-primary" on:click={handleSchedule}>Schedule Post</button>
        <button class="prc-btn-ghost" on:click={() => dispatch('regenerate', { index })}
          >Regenerate &#8635;</button
        >
        <button
          class="prc-btn-ghost"
          on:click={() =>
            dispatch('publishNow', {
              asset: {
                ...asset,
                caption: editCaption,
                hashtags: editHashtags,
                mentions: editMentions,
                location: editLocation,
                postType: editPostType,
              },
            })}>Publish Now</button
        >
      </div>
    </div>
  </div>
</div>

<style>
  .prc {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    overflow: hidden;
  }
  .prc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .prc-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }
  .prc-dots {
    display: flex;
    gap: 6px;
  }
  .prc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
  }
  .prc-dot--active {
    background: #e8464a;
  }

  .prc-body {
    display: flex;
  }

  .prc-media {
    width: 260px;
    padding: 18px;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prc-preview {
    width: 100%;
    aspect-ratio: 4/5;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
  }
  .prc-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .prc-video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #4a4a50;
    background: linear-gradient(135deg, #1a1a2e, #2a1a3e);
  }
  .prc-type-pills {
    display: flex;
    gap: 4px;
  }
  .prc-type-pill {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.04);
    color: #4a4a50;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }
  .prc-type-pill--active {
    background: rgba(232, 70, 74, 0.15);
    color: #e8464a;
    border-color: rgba(232, 70, 74, 0.2);
  }

  .prc-fields {
    flex: 1;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .prc-field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
  }
  .prc-field-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }
  .prc-field-meta {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #3a3a40;
    letter-spacing: 0.05em;
  }
  .prc-caption {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #9a9aa0;
    font-size: 13px;
    line-height: 1.6;
    font-family: 'Inter', sans-serif;
    resize: vertical;
  }
  .prc-caption:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }

  .prc-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .prc-tag {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
  }
  .prc-tag:hover {
    opacity: 0.7;
  }
  .prc-tag--blue {
    background: rgba(123, 167, 217, 0.1);
    color: #7ba7d9;
  }
  .prc-tag--purple {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
  }
  .prc-tag-add {
    display: inline;
  }
  .prc-tag-input {
    width: 60px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    color: #4a4a50;
    font-size: 10px;
    font-family: 'Inter', sans-serif;
  }
  .prc-tag-input:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }

  .prc-location-input {
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef;
    font-size: 12px;
    font-family: 'Inter', sans-serif;
    width: 200px;
  }
  .prc-location-input:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }

  .prc-schedule-row {
    display: flex;
    gap: 8px;
  }
  .prc-schedule-input {
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef;
    font-size: 12px;
    font-family: 'Inter', sans-serif;
  }
  .prc-schedule-input:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }

  .prc-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .prc-btn-primary {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.25);
    color: #e8464a;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .prc-btn-primary:hover {
    background: rgba(232, 70, 74, 0.2);
  }
  .prc-btn-ghost {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .prc-btn-ghost:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  @media (max-width: 768px) {
    .prc-body {
      flex-direction: column;
    }
    .prc-media {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/PostReviewCard.svelte
git commit -m "feat(ui): add PostReviewCard component with editable AI-generated fields"
```

---

### Task 10: Schedule Calendar Component

**Files:**

- Create: `src/lib/components/brands/ScheduleCalendar.svelte`

- [ ] **Step 1: Create the calendar component**

This is a large component — week/month toggle, post cards per day, click/drag interactions. Create the file at `src/lib/components/brands/ScheduleCalendar.svelte`.

Key structure:

- Props: `posts` (array of scheduled posts from API), event dispatchers for `editPost`, `newPost`, `reschedule`
- State: `viewMode` ('week' | 'month'), `currentDate` (anchor date for navigation)
- Computed: `weekDays` (7 days from current week), `monthDays` (grid for current month)
- Each post card shows: thumbnail/icon, time (Geist Mono), caption preview, status badge
- Status colors: scheduled = `#e8464a`, posted = `#7fc8a9`, failed = `#f87171`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface ScheduledPost {
    id: string;
    gcs_url: string;
    media_type: string;
    caption: string;
    scheduled_at: string;
    status: string;
    error_message?: string;
  }

  export let posts: ScheduledPost[] = [];
  export let loading: boolean = false;

  const dispatch = createEventDispatcher<{
    editPost: { post: ScheduledPost };
    newPost: { date: string };
    reschedule: { postId: string; newDate: string };
    retry: { postId: string };
    refresh: void;
  }>();

  let viewMode: 'week' | 'month' = 'week';
  let anchorDate = new Date();

  $: weekStart = getWeekStart(anchorDate);
  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  $: monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  $: monthGridStart = (() => {
    const d = new Date(monthStart);
    const day = d.getDay() || 7; // Mon = 1
    d.setDate(d.getDate() - (day - 1));
    return d;
  })();
  $: monthCells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(monthGridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getWeekStart(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - (day - 1));
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function postsForDate(date: Date): ScheduledPost[] {
    const dateStr = date.toISOString().split('T')[0];
    return posts.filter((p) => p.scheduled_at?.startsWith(dateStr));
  }

  function isToday(d: Date): boolean {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  function formatDay(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() + ' ' + d.getDate();
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatWeekRange(): string {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }

  function formatMonth(): string {
    return anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function navigate(dir: number) {
    const d = new Date(anchorDate);
    if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    anchorDate = d;
  }

  function statusClass(s: string): string {
    if (s === 'published') return 'posted';
    if (s === 'failed') return 'failed';
    return 'scheduled';
  }

  function statusLabel(s: string): string {
    if (s === 'published') return 'Posted ✓';
    if (s === 'failed') return 'Failed';
    if (s === 'publishing') return 'Publishing...';
    return 'Scheduled';
  }

  function mediaIcon(type: string): string {
    if (type === 'VIDEO' || type === 'REELS') return '🎬';
    if (type === 'CAROUSEL') return '📱';
    if (type === 'STORIES') return '📷';
    return '📸';
  }
</script>

<div class="cal bs-card">
  <!-- Toolbar -->
  <div class="cal-toolbar">
    <div class="cal-nav">
      <button class="cal-nav-btn" on:click={() => navigate(-1)}>←</button>
      <span class="cal-title">{viewMode === 'week' ? formatWeekRange() : formatMonth()}</span>
      <button class="cal-nav-btn" on:click={() => navigate(1)}>→</button>
    </div>
    <div class="cal-toggle">
      <button
        class="cal-toggle-btn"
        class:active={viewMode === 'week'}
        on:click={() => (viewMode = 'week')}>Week</button
      >
      <button
        class="cal-toggle-btn"
        class:active={viewMode === 'month'}
        on:click={() => (viewMode = 'month')}>Month</button
      >
    </div>
    <button
      class="cal-new-btn"
      on:click={() => dispatch('newPost', { date: new Date().toISOString().split('T')[0] })}
      >+ New Post</button
    >
  </div>

  {#if viewMode === 'week'}
    <div class="cal-week">
      {#each weekDays as day}
        <div
          class="cal-day"
          on:click={() => dispatch('newPost', { date: day.toISOString().split('T')[0] })}
          on:keydown={(e) =>
            e.key === 'Enter' && dispatch('newPost', { date: day.toISOString().split('T')[0] })}
          role="button"
          tabindex="0"
        >
          <div class="cal-day-header" class:today={isToday(day)}>
            {formatDay(day)}{isToday(day) ? ' · Today' : ''}
          </div>
          {#if isToday(day)}<div class="cal-today-line"></div>{/if}
          {#each postsForDate(day) as post}
            <button
              class="cal-post cal-post--{statusClass(post.status)}"
              on:click|stopPropagation={() => dispatch('editPost', { post })}
            >
              <div class="cal-post-thumb">{mediaIcon(post.media_type)}</div>
              <div class="cal-post-time cal-post-time--{statusClass(post.status)}">
                {formatTime(post.scheduled_at)}
              </div>
              <div class="cal-post-caption">{post.caption?.slice(0, 40) || 'No caption'}</div>
              <div class="cal-post-badges">
                <span class="cal-badge cal-badge--{statusClass(post.status)}"
                  >{statusLabel(post.status)}</span
                >
                {#if post.status === 'failed'}
                  <button
                    class="cal-retry"
                    on:click|stopPropagation={() => dispatch('retry', { postId: post.id })}
                    >↻ Retry</button
                  >
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <!-- Month view -->
    <div class="cal-month-header">
      {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d}
        <div class="cal-month-day-label">{d}</div>
      {/each}
    </div>
    <div class="cal-month-grid">
      {#each monthCells as cell}
        <button
          class="cal-month-cell"
          class:cal-month-cell--other={cell.getMonth() !== anchorDate.getMonth()}
          on:click={() => {
            anchorDate = cell;
            viewMode = 'week';
          }}
        >
          <div class="cal-month-num" class:today={isToday(cell)}>{cell.getDate()}</div>
          <div class="cal-month-dots">
            {#each postsForDate(cell) as post}
              <div class="cal-dot cal-dot--{statusClass(post.status)}"></div>
            {/each}
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="cal-legend">
    <div class="cal-legend-item">
      <div class="cal-legend-dot cal-dot--scheduled"></div>
       Scheduled
    </div>
    <div class="cal-legend-item">
      <div class="cal-legend-dot cal-dot--posted"></div>
       Posted
    </div>
    <div class="cal-legend-item">
      <div class="cal-legend-dot cal-dot--failed"></div>
       Failed
    </div>
  </div>
</div>

<style>
  .cal {
    padding: 0;
  }
  .bs-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    overflow: hidden;
  }

  .cal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .cal-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cal-nav-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    color: #4a4a50;
    padding: 5px 9px;
    font-size: 11px;
    cursor: pointer;
  }
  .cal-nav-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #8a8a90;
  }
  .cal-title {
    font-size: 14px;
    font-weight: 600;
    color: #ededef;
  }
  .cal-toggle {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.025);
    border-radius: 8px;
    padding: 2px;
  }
  .cal-toggle-btn {
    padding: 5px 14px;
    border-radius: 6px;
    border: none;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    color: #4a4a50;
    background: transparent;
  }
  .cal-toggle-btn.active {
    background: rgba(232, 70, 74, 0.15);
    color: #e8464a;
  }
  .cal-new-btn {
    padding: 7px 16px;
    border-radius: 8px;
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.25);
    color: #e8464a;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .cal-new-btn:hover {
    background: rgba(232, 70, 74, 0.2);
  }

  .cal-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    min-height: 380px;
  }
  .cal-day {
    border-right: 1px solid rgba(255, 255, 255, 0.03);
    padding: 10px;
    cursor: pointer;
  }
  .cal-day:last-child {
    border-right: none;
  }
  .cal-day:hover {
    background: rgba(255, 255, 255, 0.01);
  }
  .cal-day-header {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4a4a50;
    margin-bottom: 8px;
  }
  .cal-day-header.today {
    color: #e8464a;
  }
  .cal-today-line {
    height: 2px;
    background: #e8464a;
    border-radius: 1px;
    margin-bottom: 8px;
  }

  .cal-post {
    display: block;
    width: 100%;
    text-align: left;
    border-radius: 10px;
    padding: 8px;
    margin-bottom: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .cal-post:hover {
    transform: translateY(-1px);
  }
  .cal-post--scheduled {
    background: rgba(232, 70, 74, 0.04);
    border-color: rgba(232, 70, 74, 0.12);
  }
  .cal-post--posted {
    background: rgba(127, 200, 169, 0.04);
    border-color: rgba(127, 200, 169, 0.12);
  }
  .cal-post--failed {
    background: rgba(248, 113, 113, 0.04);
    border-color: rgba(248, 113, 113, 0.12);
  }
  .cal-post-thumb {
    font-size: 18px;
    margin-bottom: 4px;
  }
  .cal-post-time {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .cal-post-time--scheduled {
    color: #e8464a;
  }
  .cal-post-time--posted {
    color: #7fc8a9;
  }
  .cal-post-time--failed {
    color: #f87171;
  }
  .cal-post-caption {
    font-size: 11px;
    color: #8a8a90;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cal-post-badges {
    display: flex;
    gap: 3px;
    margin-top: 4px;
    align-items: center;
  }
  .cal-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .cal-badge--scheduled {
    background: rgba(232, 70, 74, 0.1);
    color: #e8464a;
  }
  .cal-badge--posted {
    background: rgba(127, 200, 169, 0.1);
    color: #7fc8a9;
  }
  .cal-badge--failed {
    background: rgba(248, 113, 113, 0.1);
    color: #f87171;
  }
  .cal-retry {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 8px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #8a8a90;
    border: none;
    cursor: pointer;
  }

  .cal-month-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .cal-month-day-label {
    padding: 8px;
    text-align: center;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    background: rgba(0, 0, 0, 0.15);
  }
  .cal-month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
  .cal-month-cell {
    padding: 8px;
    min-height: 72px;
    border-right: 1px solid rgba(255, 255, 255, 0.025);
    border-bottom: 1px solid rgba(255, 255, 255, 0.025);
    cursor: pointer;
    background: transparent;
    border-top: none;
    border-left: none;
    text-align: left;
  }
  .cal-month-cell:nth-child(7n) {
    border-right: none;
  }
  .cal-month-cell:hover {
    background: rgba(255, 255, 255, 0.015);
  }
  .cal-month-cell--other {
    opacity: 0.3;
  }
  .cal-month-num {
    font-size: 11px;
    color: #4a4a50;
    margin-bottom: 4px;
  }
  .cal-month-num.today {
    color: #e8464a;
    font-weight: 600;
  }
  .cal-month-dots {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  .cal-dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }
  .cal-dot--scheduled {
    background: #e8464a;
  }
  .cal-dot--posted {
    background: #7fc8a9;
  }
  .cal-dot--failed {
    background: #f87171;
  }

  .cal-legend {
    display: flex;
    gap: 16px;
    padding: 10px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  .cal-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.05em;
    color: #4a4a50;
  }
  .cal-legend-dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }

  @media (max-width: 768px) {
    .cal-week {
      grid-template-columns: 1fr;
    }
    .cal-day {
      min-height: auto;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/ScheduleCalendar.svelte
git commit -m "feat(ui): add ScheduleCalendar with week/month views"
```

---

### Task 11: Bulk Cadence Wizard Component

**Files:**

- Create: `src/lib/components/brands/BulkCadenceWizard.svelte`

- [ ] **Step 1: Create the bulk cadence wizard**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface UploadedAsset {
    gcsUrl: string;
    mediaType: string;
    fileName: string;
  }

  export let assets: UploadedAsset[] = [];

  const dispatch = createEventDispatcher<{
    scheduleAll: {
      assets: UploadedAsset[];
      cadence: { frequency: string; startDate: string; time: string; timezone: string };
    };
    editIndividual: void;
  }>();

  type Frequency = 'daily' | 'twice_daily' | 'every_2_days' | 'custom';
  let frequency: Frequency = 'daily';
  let startDate = new Date().toISOString().split('T')[0];
  let time = '09:00';
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const frequencyLabels: Record<Frequency, string> = {
    daily: '1/day',
    twice_daily: '2/day',
    every_2_days: 'Every 2 days',
    custom: 'Custom',
  };

  const intervalMs: Record<Frequency, number> = {
    daily: 86400000,
    twice_daily: 43200000,
    every_2_days: 172800000,
    custom: 86400000,
  };

  $: previewSlots = assets.map((asset, i) => {
    const base = new Date(`${startDate}T${time}:00`);
    const slotDate = new Date(base.getTime() + i * intervalMs[frequency]);
    return {
      asset,
      date: slotDate,
      dayLabel:
        slotDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() +
        ' ' +
        slotDate.getDate(),
      timeLabel: slotDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  });

  $: totalDays =
    assets.length > 0 ? Math.ceil((assets.length * intervalMs[frequency]) / 86400000) : 0;

  function mediaIcon(type: string): string {
    if (type === 'VIDEO' || type === 'REELS') return '🎬';
    if (type === 'CAROUSEL') return '📱';
    return '📸';
  }

  function removeAsset(idx: number) {
    assets = assets.filter((_, i) => i !== idx);
  }

  function handleScheduleAll() {
    dispatch('scheduleAll', {
      assets,
      cadence: { frequency, startDate, time, timezone },
    });
  }
</script>

<div class="bcw">
  <!-- Asset strip -->
  <div class="bcw-card">
    <span class="bcw-label">DRAG TO REORDER · {assets.length} ASSETS</span>
    <div class="bcw-strip">
      {#each assets as asset, i}
        <div class="bcw-asset">
          <div class="bcw-asset-num">{i + 1}</div>
          <button class="bcw-asset-remove" on:click={() => removeAsset(i)}>✕</button>
          <div class="bcw-asset-thumb">{mediaIcon(asset.mediaType)}</div>
          <div class="bcw-asset-meta">
            <div class="bcw-asset-name">{asset.fileName}</div>
            <div class="bcw-asset-type">{asset.mediaType}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Cadence config -->
  <div class="bcw-card" style="margin-top: 12px;">
    <span class="bcw-label">SET CADENCE</span>
    <div class="bcw-config">
      <div class="bcw-field">
        <span class="bcw-field-label">FREQUENCY</span>
        <div class="bcw-pills">
          {#each Object.entries(frequencyLabels) as [key, label]}
            <button
              class="bcw-pill"
              class:bcw-pill--active={frequency === key}
              on:click={() => (frequency = key as Frequency)}>{label}</button
            >
          {/each}
        </div>
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">STARTING</span>
        <input type="date" class="bcw-input" bind:value={startDate} />
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">TIME</span>
        <input type="time" class="bcw-input" bind:value={time} />
      </div>
      <div class="bcw-field">
        <span class="bcw-field-label">TIMEZONE</span>
        <div class="bcw-input bcw-input--static">{timezone}</div>
      </div>
    </div>

    <!-- Preview timeline -->
    {#if assets.length > 0}
      <div class="bcw-preview">
        <span class="bcw-label bcw-label--accent"
          >PREVIEW — {assets.length} POSTS OVER {totalDays} DAYS</span
        >
        <div class="bcw-timeline">
          {#each previewSlots as slot, i}
            {#if i > 0}<div class="bcw-connector"></div>{/if}
            <div class="bcw-slot">
              <div class="bcw-slot-day">{slot.dayLabel}</div>
              <div class="bcw-slot-thumb">{mediaIcon(slot.asset.mediaType)}</div>
              <div class="bcw-slot-time">{slot.timeLabel}</div>
            </div>
          {/each}
        </div>

        <div class="bcw-ai-note">
          <span>⚡</span>
          <span
            >AI will generate unique captions, hashtags, and mentions for each asset. Captions adapt
            based on post type.</span
          >
        </div>
      </div>
    {/if}

    <div class="bcw-actions">
      <button class="bcw-btn-ghost" on:click={() => dispatch('editIndividual')}
        >Edit Individual Posts</button
      >
      <button class="bcw-btn-primary" on:click={handleScheduleAll}>Generate & Schedule All</button>
    </div>
  </div>
</div>

<style>
  .bcw-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 16px;
  }
  .bcw-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    display: block;
    margin-bottom: 10px;
  }
  .bcw-label--accent {
    color: #e8464a;
  }

  .bcw-strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  .bcw-strip::-webkit-scrollbar {
    height: 3px;
  }
  .bcw-strip::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }
  .bcw-asset {
    flex-shrink: 0;
    width: 110px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    overflow: hidden;
    position: relative;
    cursor: grab;
    transition: all 0.15s;
  }
  .bcw-asset:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }
  .bcw-asset-num {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    color: #ededef;
  }
  .bcw-asset-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(248, 113, 113, 0.2);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #f87171;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .bcw-asset:hover .bcw-asset-remove {
    opacity: 1;
  }
  .bcw-asset-thumb {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: linear-gradient(135deg, #1a1a2e, #2a1a3e);
  }
  .bcw-asset-meta {
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.3);
  }
  .bcw-asset-name {
    font-size: 10px;
    color: #8a8a90;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bcw-asset-type {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4a4a50;
    margin-top: 2px;
  }

  .bcw-config {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
  }
  .bcw-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .bcw-field-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }
  .bcw-pills {
    display: flex;
    gap: 3px;
    background: rgba(255, 255, 255, 0.025);
    border-radius: 8px;
    padding: 2px;
  }
  .bcw-pill {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    color: #4a4a50;
    background: transparent;
    transition: all 0.15s;
  }
  .bcw-pill--active {
    background: rgba(232, 70, 74, 0.15);
    color: #e8464a;
  }
  .bcw-input {
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
  }
  .bcw-input:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }
  .bcw-input--static {
    color: #4a4a50;
    cursor: default;
  }

  .bcw-preview {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(232, 70, 74, 0.02);
    border: 1px solid rgba(232, 70, 74, 0.08);
  }
  .bcw-timeline {
    display: flex;
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .bcw-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
    flex-shrink: 0;
  }
  .bcw-slot-day {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4a4a50;
    margin-bottom: 6px;
  }
  .bcw-slot-thumb {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    border: 1px solid rgba(232, 70, 74, 0.15);
    background: rgba(255, 255, 255, 0.025);
  }
  .bcw-slot-time {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #e8464a;
    margin-top: 4px;
  }
  .bcw-connector {
    width: 20px;
    height: 1px;
    background: rgba(232, 70, 74, 0.15);
    margin-top: 32px;
    flex-shrink: 0;
  }

  .bcw-ai-note {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(127, 200, 169, 0.03);
    border: 1px solid rgba(127, 200, 169, 0.08);
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: #7fc8a9;
    line-height: 1.5;
  }

  .bcw-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
  }
  .bcw-btn-primary {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.25);
    color: #e8464a;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .bcw-btn-primary:hover {
    background: rgba(232, 70, 74, 0.2);
  }
  .bcw-btn-ghost {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .bcw-btn-ghost:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  @media (max-width: 768px) {
    .bcw-config {
      flex-direction: column;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/BulkCadenceWizard.svelte
git commit -m "feat(ui): add BulkCadenceWizard component"
```

---

### Task 12: Content Automation Container + Nav Integration

**Files:**

- Create: `src/lib/components/brands/ContentAutomation.svelte`
- Modify: `src/routes/brands/+layout.svelte`
- Modify: `src/routes/brands/portal/+page.svelte`

- [ ] **Step 1: Create the ContentAutomation container**

This is the main orchestrator that manages the pipeline state machine and wires all sub-components together. Create `src/lib/components/brands/ContentAutomation.svelte`:

```svelte
<script lang="ts">
  import ContentPipelineStepper from './ContentPipelineStepper.svelte';
  import PostReviewCard from './PostReviewCard.svelte';
  import ScheduleCalendar from './ScheduleCalendar.svelte';
  import BulkCadenceWizard from './BulkCadenceWizard.svelte';
  import ActivityFeed from './ActivityFeed.svelte';

  type PipelineStep = 'upload' | 'generate' | 'review' | 'schedule' | 'post';
  let currentStep: PipelineStep = 'schedule'; // Default to calendar view

  interface UploadedAsset {
    gcsUrl: string;
    mediaType: string;
    fileName: string;
  }

  interface GeneratedPost {
    gcsUrl: string;
    mediaType: string;
    fileName?: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    location: string;
    altText: string;
    postType: string;
  }

  interface ScheduledPost {
    id: string;
    gcs_url: string;
    media_type: string;
    caption: string;
    scheduled_at: string;
    status: string;
    error_message?: string;
  }

  let uploadedAssets: UploadedAsset[] = [];
  let generatedPosts: GeneratedPost[] = [];
  let scheduledPosts: ScheduledPost[] = [];
  let reviewIndex = 0;
  let generating = false;
  let uploading = false;
  let calendarLoading = false;
  let contextHint = '';
  let uploadError = '';

  // Load scheduled posts for calendar
  async function loadScheduledPosts() {
    calendarLoading = true;
    try {
      const res = await fetch('/api/brand/scheduled-posts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        scheduledPosts = data.posts || [];
      }
    } catch {
      /* silent */
    } finally {
      calendarLoading = false;
    }
  }

  // Upload files
  async function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    await uploadFiles(Array.from(input.files));
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer?.files.length) return;
    await uploadFiles(Array.from(e.dataTransfer.files));
  }

  async function uploadFiles(files: File[]) {
    uploading = true;
    uploadError = '';
    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/brand/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const newAssets: UploadedAsset[] = (data.uploads || []).map(
        (u: { url: string; mediaType: string; fileName: string }) => ({
          gcsUrl: u.url,
          mediaType: u.mediaType,
          fileName: u.fileName,
        }),
      );
      uploadedAssets = [...uploadedAssets, ...newAssets];
      currentStep = uploadedAssets.length > 1 ? 'generate' : 'generate';
    } catch (e) {
      uploadError = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  // Generate AI content
  async function generateContent(assets: UploadedAsset[]) {
    generating = true;
    currentStep = 'generate';
    try {
      const res = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets, context: contextHint || undefined }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      generatedPosts = data.results || [];
      reviewIndex = 0;
      currentStep = 'review';
    } catch {
      uploadError = 'AI generation failed — try again';
      currentStep = 'upload';
    } finally {
      generating = false;
    }
  }

  // Schedule single post
  async function schedulePost(e: CustomEvent<{ asset: GeneratedPost; scheduledAt: string }>) {
    const { asset, scheduledAt } = e.detail;
    try {
      await fetch('/api/brand/schedule', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: [
            {
              gcsUrl: asset.gcsUrl,
              mediaType: asset.postType || asset.mediaType,
              caption: asset.caption,
              hashtags: asset.hashtags,
              altText: asset.altText,
              scheduledAt,
            },
          ],
        }),
      });
      // Move to next post or calendar
      if (reviewIndex < generatedPosts.length - 1) {
        reviewIndex++;
      } else {
        currentStep = 'schedule';
        loadScheduledPosts();
      }
    } catch {
      uploadError = 'Scheduling failed';
    }
  }

  // Bulk schedule
  async function bulkSchedule(
    e: CustomEvent<{
      assets: UploadedAsset[];
      cadence: { frequency: string; startDate: string; time: string; timezone: string };
    }>,
  ) {
    const { cadence } = e.detail;
    generating = true;
    currentStep = 'generate';
    try {
      // First generate content for all assets
      const genRes = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: uploadedAssets, context: contextHint || undefined }),
      });
      if (!genRes.ok) throw new Error('Generation failed');
      const genData = await genRes.json();
      const posts = (genData.results || []).map((r: GeneratedPost) => ({
        gcsUrl: r.gcsUrl,
        mediaType: r.postType || r.mediaType,
        caption: r.caption,
        hashtags: r.hashtags,
        altText: r.altText,
      }));

      // Then bulk schedule
      const schedRes = await fetch('/api/brand/schedule-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts, cadence }),
      });
      if (!schedRes.ok) throw new Error('Scheduling failed');

      currentStep = 'schedule';
      loadScheduledPosts();
    } catch {
      uploadError = 'Bulk scheduling failed';
      currentStep = 'upload';
    } finally {
      generating = false;
    }
  }

  // Retry failed post
  async function retryPost(e: CustomEvent<{ postId: string }>) {
    try {
      await fetch('/api/brand/publish-now', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: e.detail.postId }),
      });
      loadScheduledPosts();
    } catch {
      /* silent */
    }
  }

  // Regenerate single post content
  async function regeneratePost(e: CustomEvent<{ index: number }>) {
    const idx = e.detail.index;
    const asset = uploadedAssets[idx];
    if (!asset) return;
    generating = true;
    try {
      const res = await fetch('/api/brand/generate-post-content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: [asset], context: contextHint || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]) {
          generatedPosts = generatedPosts.map((p, i) => (i === idx ? data.results[0] : p));
        }
      }
    } catch {
      /* silent */
    } finally {
      generating = false;
    }
  }

  // Navigate to upload from calendar
  function handleNewPost(e: CustomEvent<{ date: string }>) {
    currentStep = 'upload';
  }

  // Init: load calendar
  import { onMount } from 'svelte';
  onMount(loadScheduledPosts);
</script>

<div class="ca-container">
  <div class="ca-main">
    <ContentPipelineStepper {currentStep} />

    {#if currentStep === 'upload'}
      <div class="ca-card">
        <span class="ca-label">DROP ASSETS</span>
        <div
          class="ca-upload-zone"
          on:drop={handleDrop}
          on:dragover|preventDefault
          role="button"
          tabindex="0"
        >
          <div class="ca-upload-icon">⇪</div>
          <div class="ca-upload-title">Drop images, videos, or carousels</div>
          <div class="ca-upload-hint">.jpg .png .webp .mp4 .mov — or multiple for carousels</div>
          <label class="ca-upload-browse">
            or browse files
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              on:change={handleFiles}
              style="display:none"
            />
          </label>
        </div>
        <div class="ca-context">
          <span class="ca-label" style="margin-bottom:4px">CONTEXT FOR AI (OPTIONAL)</span>
          <input
            class="ca-context-input"
            bind:value={contextHint}
            placeholder=""summer campaign", "behind the scenes", "product launch"..."
          />
        </div>
        {#if uploading}
          <div class="ca-status">Uploading...</div>
        {/if}
        {#if uploadError}
          <div class="ca-error">{uploadError}</div>
        {/if}
        {#if uploadedAssets.length > 0}
          <div class="ca-uploaded-bar">
            <span class="ca-label"
              >{uploadedAssets.length} ASSET{uploadedAssets.length > 1 ? 'S' : ''} READY</span
            >
            {#if uploadedAssets.length > 1}
              <button class="ca-btn-primary" on:click={() => (currentStep = 'generate')}
                >Set Cadence & Generate</button
              >
            {:else}
              <button class="ca-btn-primary" on:click={() => generateContent(uploadedAssets)}
                >Generate Content</button
              >
            {/if}
          </div>
        {/if}
      </div>
    {:else if currentStep === 'generate'}
      {#if uploadedAssets.length > 1}
        <BulkCadenceWizard
          assets={uploadedAssets}
          on:scheduleAll={bulkSchedule}
          on:editIndividual={() => generateContent(uploadedAssets)}
        />
      {:else}
        <div class="ca-card">
          <span class="ca-label" style="color:#e8464a">AI GENERATING</span>
          <div class="ca-processing">
            <div class="ca-proc-title">Generating content...</div>
            <div class="ca-proc-sub">Analysing visuals · Reading brand kit · Writing captions</div>
          </div>
        </div>
      {/if}
    {:else if currentStep === 'review' && generatedPosts.length > 0}
      <PostReviewCard
        asset={generatedPosts[reviewIndex]}
        index={reviewIndex}
        total={generatedPosts.length}
        on:schedule={schedulePost}
        on:regenerate={regeneratePost}
        on:publishNow={(e) => {
          // Publish now flow — same as schedule but immediate
          const { asset } = e.detail;
          fetch('/api/brand/publish-now', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Need to schedule first then publish
              postId: 'temp',
            }),
          });
        }}
      />
    {:else if currentStep === 'schedule'}
      <ScheduleCalendar
        posts={scheduledPosts}
        loading={calendarLoading}
        on:newPost={handleNewPost}
        on:retry={retryPost}
        on:refresh={loadScheduledPosts}
      />
    {/if}
  </div>

  <ActivityFeed />
</div>

<style>
  .ca-container {
    display: flex;
    gap: 0;
    min-height: 500px;
  }
  .ca-main {
    flex: 1;
    padding: 0 16px 16px;
    min-width: 0;
  }

  .ca-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 16px;
  }
  .ca-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    display: block;
    margin-bottom: 8px;
  }

  .ca-upload-zone {
    border: 1.5px dashed rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 40px 24px;
    text-align: center;
    background: rgba(255, 255, 255, 0.015);
    cursor: pointer;
    transition: all 0.2s;
  }
  .ca-upload-zone:hover {
    border-color: rgba(232, 70, 74, 0.3);
    background: rgba(232, 70, 74, 0.02);
  }
  .ca-upload-icon {
    font-size: 28px;
    margin-bottom: 10px;
    opacity: 0.5;
  }
  .ca-upload-title {
    font-size: 14px;
    font-weight: 600;
    color: #ededef;
  }
  .ca-upload-hint {
    font-size: 11px;
    color: #4a4a50;
    margin-top: 4px;
  }
  .ca-upload-browse {
    display: inline-block;
    margin-top: 14px;
    padding: 6px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8a8a90;
    font-size: 11px;
    cursor: pointer;
  }

  .ca-context {
    margin-top: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .ca-context-input {
    width: 100%;
    background: transparent;
    border: none;
    color: #8a8a90;
    font-size: 12px;
    font-family: 'Inter', sans-serif;
  }
  .ca-context-input:focus {
    outline: none;
  }
  .ca-context-input::placeholder {
    color: #4a4a50;
    font-style: italic;
  }

  .ca-status {
    margin-top: 10px;
    font-size: 12px;
    color: #e8464a;
  }
  .ca-error {
    margin-top: 10px;
    font-size: 12px;
    color: #f87171;
  }

  .ca-uploaded-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(232, 70, 74, 0.03);
    border: 1px solid rgba(232, 70, 74, 0.08);
  }
  .ca-uploaded-bar .ca-label {
    margin-bottom: 0;
    color: #e8464a;
  }

  .ca-btn-primary {
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.25);
    color: #e8464a;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .ca-btn-primary:hover {
    background: rgba(232, 70, 74, 0.2);
  }

  .ca-processing {
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(232, 70, 74, 0.03);
    border: 1px solid rgba(232, 70, 74, 0.1);
  }
  .ca-proc-title {
    font-size: 13px;
    font-weight: 600;
    color: #ededef;
  }
  .ca-proc-sub {
    font-size: 11px;
    color: #4a4a50;
    margin-top: 2px;
  }

  @media (max-width: 1024px) {
    .ca-container {
      flex-direction: column;
    }
  }
</style>
```

- [ ] **Step 2: Add the automation tab to the layout nav**

In `src/routes/brands/+layout.svelte`, update the `sections` array (around line 17) to add the automation tab and shift profile:

Change:

```typescript
const sections = [
  { num: '01', label: 'Content Studio', href: '/brands/portal?tab=content' },
  { num: '02', label: 'Find Creators', href: '/brands/creators' },
  { num: '03', label: 'Profile & Insights', href: '/brands/portal?tab=profile' },
] as const;
```

To:

```typescript
const sections = [
  { num: '01', label: 'Content Studio', href: '/brands/portal?tab=content' },
  { num: '02', label: 'Find Creators', href: '/brands/creators' },
  { num: '03', label: 'Content Automation', href: '/brands/portal?tab=automation' },
  { num: '04', label: 'Profile & Insights', href: '/brands/portal?tab=profile' },
] as const;
```

- [ ] **Step 3: Add automation tab handling to portal page**

In `src/routes/brands/portal/+page.svelte`, make these changes:

1. Add the import at the top of the script (after the BrandOsDashboard import, around line 21):

```typescript
import ContentAutomation from '$lib/components/brands/ContentAutomation.svelte';
```

2. Update the `portalTab` type and URL tab check (around lines 26-35):

Change:

```typescript
$: urlTab = $page.url.searchParams.get('tab') as 'content' | 'creators' | 'profile' | null;
let portalTab: 'content' | 'creators' | 'profile' = data.brandProfile ? 'content' : 'creators';
```

To:

```typescript
$: urlTab = $page.url.searchParams.get('tab') as
  | 'content'
  | 'creators'
  | 'profile'
  | 'automation'
  | null;
let portalTab: 'content' | 'creators' | 'profile' | 'automation' = data.brandProfile
  ? 'content'
  : 'creators';
```

And update the URL tab validation:

```typescript
$: if (urlTab && ['content', 'creators', 'profile', 'automation'].includes(urlTab)) {
  portalTab = urlTab;
}
```

3. Add the automation tab rendering. After the `{:else if portalTab === 'profile' && data.brandProfile}` block (around line 944), add:

```svelte
    {:else if portalTab === 'automation' && data.brandProfile}
      <ContentAutomation />
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/brands/ContentAutomation.svelte src/routes/brands/+layout.svelte src/routes/brands/portal/+page.svelte
git commit -m "feat: wire ContentAutomation tab into brand portal with full pipeline"
```

---

### Task 13: Manual Testing & Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to the Content Automation tab**

Open `http://localhost:5173/brands/portal?tab=automation` (or wherever the dev server runs). Verify:

- The nav bar shows 4 tabs with "03 — Content Automation" highlighted
- The pipeline stepper renders with 5 steps
- The calendar view loads with any existing scheduled posts
- The activity feed sidebar appears on the right

- [ ] **Step 3: Test the upload flow**

1. Click the upload zone or drag an image file
2. Verify the file uploads to GCS
3. Click "Generate Content"
4. Verify the PostReviewCard shows with AI-generated caption, hashtags, mentions
5. Edit a caption, remove a hashtag, add a mention
6. Click "Schedule Post" with a date/time
7. Verify the post appears on the calendar

- [ ] **Step 4: Test bulk cadence**

1. Upload 3+ files
2. Verify the BulkCadenceWizard appears
3. Set frequency to "1/day", pick a start date
4. Verify the preview timeline shows correct slots
5. Click "Generate & Schedule All"
6. Verify all posts appear on the calendar

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: address testing feedback for content automation"
```

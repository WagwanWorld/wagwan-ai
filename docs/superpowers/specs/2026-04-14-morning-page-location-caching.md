# Morning Page + Location + Caching Layer

**Date:** 2026-04-14
**Goal:** Make the home page the page you open every morning — time-aware greeting, calendar, personalized news, music with artwork, suggested reads. Add location input to onboarding/profile (once per month update). Cache all LLM-computed content in Redis (hot) + Supabase (persistent) so the LLM only runs on signal refresh, not every page load.

---

## 1. Caching Architecture

### Principle
Compute once, cache aggressively, serve from cache. LLM recomputes only when:
- User connects/reconnects a platform
- User updates location (once per month)
- User manually hits "Refresh" on the home page
- Cache TTL expires (24hr for morning brief, 7 days for identity data)

### Two-Layer Cache

**Redis (hot cache):**
- Key pattern: `wagwan:{googleSub}:{dataType}`
- TTLs: morning_brief = 24hr, suggested_reads = 7 days, news = 12hr, calendar_context = 1hr
- Fast reads on every page load
- If Redis is down, fall through to Supabase

**Supabase (persistent cache):**
- New `cached_content` table with columns: `google_sub`, `content_type`, `payload` (jsonb), `generated_at`, `expires_at`
- Survives Redis restarts and deploys
- If Supabase cache hit but Redis miss, backfill Redis
- If both miss, trigger LLM recompute

### Cache Flow
```
Page load → Redis get → hit? serve
                      → miss? → Supabase get → hit? serve + backfill Redis
                                             → miss? → LLM compute → store both
```

### Content Types Cached

| Content Type | Redis TTL | Supabase TTL | Recompute Trigger |
|-------------|-----------|-------------|-------------------|
| `morning_brief` | 24hr | 24hr | Daily auto, location change |
| `suggested_reads` | 7 days | 7 days | Platform reconnect, location change |
| `news_feed` | 12hr | 12hr | Daily auto, location change |
| `calendar_context` | 1hr | 1hr | Calendar sync |
| `music_artwork` | 30 days | 30 days | Music platform reconnect |

---

## 2. Location System

### Onboarding (Step 0 enhancement)
After phone OTP verification succeeds (before advancing to Step 1), show a location input:
- Text input with placeholder "Your city (e.g. Mumbai)"
- Store in localStorage as part of the onboarding state
- Saved to profile on setup completion
- Not required — can skip

### Profile Page
- Location field visible in profile settings
- Disabled if updated within last 30 days
- Shows: "You can update your location on {date}" when disabled
- When updated: saves to Supabase, triggers signal refresh, resets cache

### Data Model
Add to `UserProfile` interface:
- `locationUpdatedAt: string` — ISO timestamp of last location update

Add to Supabase `user_profiles` table:
- `location_updated_at` column (timestamp, nullable)

### Signal Refresh on Location Change
When location updates:
1. Save new city to profile (localStorage + Supabase)
2. Set `locationUpdatedAt` to now
3. Invalidate Redis cache keys: `morning_brief`, `news_feed`, `suggested_reads`
4. Call `POST /api/refresh-signals` to recompute identity graph with new location context
5. The next page load will cache-miss and trigger fresh LLM content

---

## 3. Morning Brief API

### `GET /api/home/morning-brief`

Query params: `sub={googleSub}`

Response:
```json
{
  "ok": true,
  "greeting": "Good morning, Madhvik",
  "news": [
    {
      "headline": "...",
      "summary": "...",
      "source": "TechCrunch",
      "url": "...",
      "relevance": "Matches your fintech interest"
    }
  ],
  "reads": [
    {
      "title": "...",
      "author": "...",
      "type": "book",
      "why": "Based on your cross-cultural creator archetype",
      "url": "..."
    }
  ],
  "cached": true,
  "generatedAt": "2026-04-14T06:00:00Z"
}
```

### Generation Logic
1. Check Redis → Supabase → cache miss
2. On miss: build search queries from identity graph:
   - 2 queries from career/professional signals + location
   - 1 query from active interests/hobbies
   - 1 query from current events in user's city
3. Run Brave Search for each query (existing `searchWeb` function)
4. Send results + identity snapshot to Claude with prompt:
   - "Pick the 3-4 most relevant news items for this person. For each, write a 1-line summary and explain why it's relevant to them."
   - "Suggest 2-3 books or articles this person would find valuable based on their identity. For each, explain why."
5. Store response in Redis + Supabase
6. Return to client

---

## 4. Music Artwork Enhancement

### Artist Images
The `itunesArtwork.ts` client already exists. Enhance `ArtistStrip` to:
1. On mount, call `fetchArtistArtwork(artistNames)` from `$lib/client/itunesArtwork`
2. Show album art circles instead of gradient fallbacks
3. Cache artwork URLs in Redis (30-day TTL) so iTunes API isn't hit every page load

### Album Art Cache API
New endpoint: `GET /api/home/artist-artwork?artists=name1,name2,...`
- Checks Redis for cached URLs
- On miss: calls iTunes Search API, caches results
- Returns: `{ "Artist Name": "https://artwork.url/300x300.jpg", ... }`

---

## 5. Calendar Today View

### Component: `CalendarToday.svelte`
- Fetches from existing `GET /api/google/calendar` endpoint
- Shows next 3-4 events for today
- Each event: time + title, color-coded (blue for work, gold for personal, red for suggested)
- If no Google connected: shows "Connect Google for your schedule" nudge
- Cache calendar in Redis with 1hr TTL

---

## 6. Time-Aware Greeting

In HeroIdentity, replace the static greeting with time-based:
- 5am-12pm: "Good morning, {firstName}"
- 12pm-5pm: "Good afternoon, {firstName}"
- 5pm-9pm: "Good evening, {firstName}"
- 9pm-5am: "Hey {firstName}" (late night, casual)

This is pure client-side, no caching needed.

---

## 7. Frontend Changes

### Home Page Identity Column (updated order)

1. **Hero** — time-aware greeting, one-liner, contradiction, archetype, pills
2. **📅 Today** — calendar events (horizontal scroll, compact cards)
3. **🎵 How You Listen** — artist strip WITH artwork, genre donut, heatmap, narrative
4. **📰 Your Brief** — personalized news cards (vertical stack, 3-4 items)
5. **📚 Reads For You** — book/article cards (horizontal scroll, 2-3 items)
6. **📱 How You Show Up** — social bar chart, reach, narrative
7. **🧭 Where You're Headed** — trajectory, score rings, predictions
8. **For You** — existing ForYouTabs

### New Components

| Component | Purpose |
|-----------|---------|
| `CalendarToday.svelte` | Today's calendar events, compact horizontal scroll |
| `MorningBrief.svelte` | News cards with relevance tags |
| `SuggestedReads.svelte` | Book/article recommendation cards |

### Modified Components

| Component | Change |
|-----------|--------|
| `HeroIdentity.svelte` | Add time-aware greeting |
| `ArtistStrip.svelte` | Fetch and display iTunes artwork |

---

## 8. Database Migration

New Supabase table:
```sql
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

Add to `user_profiles`:
```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
```

---

## 9. New Server Modules

| File | Purpose |
|------|---------|
| `src/lib/server/contentCache.ts` | Two-layer cache: Redis get/set + Supabase fallback |
| `src/routes/api/home/morning-brief/+server.ts` | Morning brief generation + caching |
| `src/routes/api/home/artist-artwork/+server.ts` | iTunes artwork with Redis cache |
| `supabase/008_cached_content.sql` | Migration for cached_content table |
| `supabase/009_location_updated_at.sql` | Migration for location_updated_at column |

---

## 10. Files Changed Summary

| Action | File | What |
|--------|------|------|
| Create | `src/lib/server/contentCache.ts` | Redis + Supabase two-layer cache module |
| Create | `src/routes/api/home/morning-brief/+server.ts` | Morning brief API |
| Create | `src/routes/api/home/artist-artwork/+server.ts` | Artwork cache API |
| Create | `supabase/008_cached_content.sql` | cached_content table |
| Create | `supabase/009_location_updated_at.sql` | location_updated_at column |
| Create | `src/lib/components/home/CalendarToday.svelte` | Calendar today view |
| Create | `src/lib/components/home/MorningBrief.svelte` | News cards component |
| Create | `src/lib/components/home/SuggestedReads.svelte` | Reading recommendations |
| Modify | `src/lib/components/home/HeroIdentity.svelte` | Time-aware greeting |
| Modify | `src/lib/components/home/ArtistStrip.svelte` | Fetch iTunes artwork |
| Modify | `src/routes/(app)/home/+page.svelte` | Wire new sections + cache reads |
| Modify | `src/routes/onboarding/+page.svelte` | Add location input to Step 0 |
| Modify | `src/routes/(app)/profile/+page.svelte` | Location field with monthly lock |
| Modify | `src/lib/stores/profile.ts` | Add locationUpdatedAt to UserProfile |
| Modify | `src/lib/server/supabase.ts` | Add location_updated_at handling |

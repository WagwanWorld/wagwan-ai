# Apify-Powered Discovery Loop — Design Spec

## What it is

A growth engine that uses Apify Instagram scraping to create a two-sided discovery loop:

1. **Brands discover creators** — Apify scrapes public Instagram accounts by hashtag/niche, scores them against the brand's identity, and surfaces them as potential collaborators. These are creators NOT yet on Wagwan.
2. **Creators get invited** — when a brand expresses interest in an external creator, Wagwan sends an invite ("Brand X wants to collaborate with you") via DM draft or link. The creator signs up, connects their Instagram, and now both sides are on the platform.
3. **The loop compounds** — more brands → more creator discovery → more creator invites → more creators on platform → better matches for brands → more brands.

This is exclusively a **brand-side feature**. Creators benefit passively by getting discovered and invited.

## Architecture

### Data Flow

```
Brand runs analysis
    ↓
Apify scrapes niche hashtags + competitor followers
    ↓
Returns public profiles: handle, bio, followers, posts, engagement
    ↓
Claude scores each against brand's identity graph
    ↓
Top matches stored as "discovered creators" in Supabase
    ↓
Brand sees them in "Discover" section on dashboard
    ↓
Brand clicks "Invite" → generates personalized DM draft
    ↓
Creator joins Wagwan → becomes a full platform user
    ↓
Future brands get better matches (the loop)
```

### Apify Integration

**Actors used:**

- `apidojo/instagram-scraper` (pay-per-result, ~$0.0004/item) — scrape posts by hashtag to find active creators
- `apidojo/instagram-user-scraper` ($0.02/search) — enrich discovered profiles with full bio, follower count, post history

**When it runs:**

- Triggered during Phase 2e of "Run Analysis" (creator matching phase)
- Also available as a standalone "Discover Creators" action
- Weekly cron can run it automatically for all active brands

**Budget guard:** configurable max spend per brand per month (default $5). Tracked in Supabase.

### What gets scraped

For each brand, the system:

1. Takes the brand's top 5 hashtags (from identity graph) + content pillar keywords
2. Scrapes recent posts under those hashtags via Apify (50-100 posts per hashtag)
3. Extracts unique creator profiles from those posts
4. Filters: 1K-100K followers (micro/mid tier), public account, posted in last 30 days
5. Enriches top 20 profiles with full bio + recent 12 posts
6. Claude scores each against the brand's identity (aesthetic match, audience overlap signals, content theme alignment)
7. Stores top 10 as "discovered creators" with match reasoning

### What the brand sees

A new "Discover" section on the brand dashboard (between Creator Matches and Competitor Watch):

**Collapsed (summary):**

- "12 creators discovered in your niche"
- 3-4 horizontal scroll avatar chips (like existing creator matches)
- "Last scanned: 2 days ago"

**Expanded (detail):**

- Each discovered creator as a card:
  - Profile picture, name, @handle, followers, bio
  - Match score (0-100) with reasoning
  - Top 3 recent post thumbnails
  - Content themes as tags
  - "Invite to Wagwan" button → generates DM draft
  - "View on Instagram" link
- "Scan again" button to re-run discovery
- Hashtags used for discovery shown as filter chips

### Invite Flow

When a brand clicks "Invite" on a discovered creator:

1. System generates a personalized DM draft:
   - References the creator's content specifically
   - Explains why the brand wants to collaborate
   - Includes a Wagwan signup link with referral tracking (`?ref=brand_[igUserId]&from=[brandHandle]`)
   - Written in the brand's voice (from voice guidelines)

2. Brand sees the draft in a modal:
   - Can edit the message
   - "Copy & Open Instagram" button (deep link to creator's profile)
   - Manual send (Instagram API doesn't allow cold DMs)

3. Invite tracked in Supabase:
   - `brand_ig_id`, `creator_ig_username`, `invited_at`, `message_draft`, `status` (sent/pending/joined)
   - When the creator signs up with the referral link, status updates to "joined"

### Creator-side: Benchmarking (lightweight add-on)

When a creator is on Wagwan and runs their own analysis, the system can:

- Use Apify to scrape 3-5 similar creators in their niche (based on shared hashtags)
- Show benchmarks: "Your engagement rate (4.2%) is 1.8x the niche average (2.3%)"
- This is NOT a brand feature — it's a creator retention feature, shown on the creator app's home page

This is a future add-on, not part of the initial build.

## Data Store

```sql
-- Discovered creators (from Apify scraping)
CREATE TABLE IF NOT EXISTS brand_discovered_creators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id     TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  creator_ig_username TEXT NOT NULL,
  creator_data    JSONB NOT NULL DEFAULT '{}',  -- profile, bio, followers, posts, engagement
  match_score     INTEGER DEFAULT 0,
  match_reasoning TEXT DEFAULT '',
  source_hashtags TEXT[] DEFAULT '{}',
  discovered_at   TIMESTAMPTZ DEFAULT now(),
  invite_status   TEXT DEFAULT 'discovered',  -- discovered | invited | joined
  invite_message  TEXT DEFAULT '',
  invited_at      TIMESTAMPTZ,

  UNIQUE(brand_ig_id, creator_ig_username)
);
CREATE INDEX idx_bdc_brand ON brand_discovered_creators(brand_ig_id, match_score DESC);

-- Apify usage tracking (budget guard)
CREATE TABLE IF NOT EXISTS apify_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  actor_id      TEXT NOT NULL,
  items_scraped INTEGER DEFAULT 0,
  cost_usd      NUMERIC(6,4) DEFAULT 0,
  run_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_au_brand_month ON apify_usage(brand_ig_id, run_at DESC);
```

## API Endpoints

| Endpoint                                          | Method | Purpose                                   |
| ------------------------------------------------- | ------ | ----------------------------------------- |
| `/api/brand/intelligence/discover`                | POST   | Run Apify discovery for the brand's niche |
| `/api/brand/intelligence/discovered`              | GET    | Get discovered creators for this brand    |
| `/api/brand/intelligence/invite`                  | POST   | Generate invite DM draft for a creator    |
| `/api/brand/intelligence/invite/:username/status` | PATCH  | Update invite status                      |

## Server Modules

| File                               | Role                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/server/apifyClient.ts`    | Apify API client — run actors, poll results, track usage               |
| `src/lib/server/brandDiscovery.ts` | Discovery logic — hashtag selection, profile filtering, Claude scoring |

## Environment Variables

```
APIFY_API_TOKEN=apify_api_...     # Apify API token
APIFY_MONTHLY_BUDGET_USD=50       # Max spend per month across all brands
```

## UI Components

| Component                        | Role                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `StratDiscoveredCreators.svelte` | Discovery section in dashboard — summary + expanded list |

This renders inside BrandStrategist as a new GlassCard between Creator Matches and Competitor Watch.

## What this does NOT include

- **Auto-DM sending** — Instagram doesn't allow cold outreach via API. Always copy-and-send.
- **Follower list scraping** — too expensive and legally risky. Hashtag-based discovery is cheaper and defensible.
- **Creator benchmarking** — future add-on, not in this build.
- **Real-time monitoring** — discovery runs on-demand or weekly, not streaming.

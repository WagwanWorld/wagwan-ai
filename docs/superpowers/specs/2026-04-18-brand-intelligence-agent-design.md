# Brand Intelligence Agent — Design Spec

## What it is

A persistent, stateful intelligence agent that deeply analyses a brand's Instagram account, tracks its trajectory over time, scopes competitors, matches creators, and proposes strategic moves. It runs weekly on a cron, stores everything it learns in Supabase, and exposes a clean internal API that any surface in Wagwan can query — the brands dashboard, the creator-facing app (when creators see matched brands), and the AI chat (conversational brand strategy).

It is not a dashboard feature. The dashboard is one consumer. The agent is the brain.

## Architecture: Three Layers

### Layer 1: Deep Analysis (the brain)

Pulls every available metric from the Instagram Graph API using existing OAuth scopes (`instagram_business_basic`, `instagram_business_manage_insights`, `instagram_business_manage_comments`) and runs multi-phase Claude inference.

#### Instagram API data ingestion

**Account-level insights** (`GET /{user_id}/insights`):
- `impressions` — total times content was seen (period: `day`, last 30 days)
- `reach` — unique accounts that saw content (period: `day`, last 30 days)
- `profile_views` — profile visits (period: `day`, last 30 days)
- `follower_demographics` — breakdown by age bucket, gender, top 5 cities, top 5 countries (period: `lifetime`)
- `online_followers` — hourly distribution of when followers are online (period: `lifetime`)

**Per-post insights** (`GET /{media_id}/insights` for last 25 posts):
- `impressions` — times the post was seen
- `reach` — unique accounts reached
- `saved` — bookmarks (strongest purchase-intent signal)
- `shares` — reshares
- `video_views` / `plays` — for video/reel content
- `total_interactions` — sum of all engagement

**Reel-specific insights** (for posts where `media_type === 'REELS'`):
- `plays`, `reach`, `saved`, `shares`, `total_interactions`

**Existing data** (already implemented):
- Profile: followers, following, posts, bio, avatar
- Media feed: last 25 posts with captions, timestamps, likes, comments, permalinks, thumbnails
- Comments: top 5 posts x 15 comments each
- Carousel children expansion

#### Claude inference pipeline (8 phases)

Phases 1-5 are the existing identity pipeline, extended:

- **Phase 1: Metadata extraction** (deterministic) — caption signals, hashtags, mentions, posting cadence, creator tier classification
- **Phase 2: Visual identity** (Claude Vision) — scene categories, aesthetic profile (brightness/tone/composition), color palette, indoor/outdoor ratio, fashion/cuisine/location types
- **Phase 3A: Bio parsing** (deterministic) — keywords, roles, emojis, location mentions
- **Phase 3B: Caption + bio synthesis** (Claude LLM) — city, interests, aesthetic, lifestyle, brand vibes, personality scores (expressive/humor/introspective 0-1), caption intent
- **Phase 4A: Temporal patterns** (deterministic) — activity pattern, peak days/hours, consistency
- **Phase 4B: Engagement scoring** (deterministic) — avg like rate, engagement tier, top content type, social visibility
- **Phase 4C: Comment graph** (Claude LLM) — community tone, circle density, external perception

New phases:

- **Phase 6: Audience Portrait** (Claude LLM) — takes demographic data (age/gender/city/country) + engagement patterns + comment graph and synthesises a narrative audience profile. Output: `audiencePortrait` string (2-3 sentences), `primaryDemographic` object (`{ ageRange, gender, topCities, topCountries }`), `audiencePersonas` array (2-3 persona descriptions with names/behaviors)
- **Phase 7: Content Performance Matrix** (Claude LLM) — takes per-post insights (impressions/reach/saves/shares for each post) and identifies content archetypes. Output: `contentArchetypes` array (each with `{ archetype, description, avgReach, avgSaves, avgShares, bestFormat, examplePostIds }`), `reachDrivers` (what gets discovered), `saveDrivers` (what gets bookmarked), `shareDrivers` (what gets shared), `formatRanking` (formats ranked by each objective)
- **Phase 8: Strategic Positioning** (Claude LLM) — takes the full signal bundle from phases 1-7 + competitor analysis and outputs: `brandDirection` (strategic positioning, 2-3 sentences), `contentPillars` (4 pillars), `voiceGuidelines` (tone, vocabulary, caption structure), `competitiveGaps` (opportunities competitors aren't covering), `bigBet` (one bold strategic recommendation with reasoning), `quickWins` (3 immediate actions)

#### Competitor analysis

The brand specifies 3-5 competitor/adjacent Instagram handles. For each:

**Data collection** (using the brand's token to fetch public data):
- Fetch profile: `GET /{username}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count` (requires finding their IG user ID via username search or the brand providing the handle)
- Fetch last 12 posts: `GET /{user_id}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url&limit=12`
- Note: we cannot fetch insights for accounts we don't own — only public data (posts, likes, comments, captions)

**Claude analysis** (lightweight, per competitor):
- Aesthetic classification
- Content theme extraction
- Posting cadence
- Hashtag strategy
- Estimated engagement rate (likes+comments / followers)
- Content format mix (% reels vs carousels vs images)

**Competitive matrix** (Claude LLM on all competitors together):
- Side-by-side comparison: engagement rate, posting frequency, content mix, aesthetic
- Overlap analysis: shared hashtags, similar themes, audience crossover signals
- Gap identification: niches/formats/themes competitors aren't covering
- Positioning recommendations: where the brand can differentiate

### Layer 2: Trajectory Tracking (the memory)

#### Weekly snapshots

Every week the cron stores a `brand_snapshot` row containing:

```
{
  snapshot_date: date,
  brand_ig_id: string,
  
  // Account metrics
  followers: number,
  following: number,
  media_count: number,
  impressions_7d: number,
  reach_7d: number,
  profile_views_7d: number,
  
  // Engagement metrics (computed from last 25 posts)
  engagement_rate: number,
  avg_likes: number,
  avg_comments: number,
  avg_saves: number,
  avg_shares: number,
  avg_reach: number,
  posts_per_week: number,
  
  // Audience demographics
  demographics: {
    age_buckets: Record<string, number>,
    gender_split: { male: number, female: number, unknown: number },
    top_cities: Array<{ city: string, pct: number }>,
    top_countries: Array<{ country: string, pct: number }>
  },
  
  // Content performance
  best_format: string,
  format_breakdown: Record<string, { count: number, avg_reach: number, avg_saves: number }>,
  top_post_ids: string[],
  
  // Competitor snapshots
  competitors: Array<{
    handle: string,
    followers: number,
    engagement_rate: number,
    posts_per_week: number,
    top_themes: string[]
  }>,
  
  // Full intelligence blob (phases 1-8 output)
  intelligence: object
}
```

#### Trend computation

On each new snapshot, the agent computes:

- **Week-over-week deltas**: followers (+/-), engagement rate change, reach change, saves change
- **4-week rolling averages**: smoothed trend lines for key metrics
- **Anomaly flags**: any metric that moved more than 2 standard deviations from its 4-week average, with Claude-generated explanation ("Your reach dropped 35% this week — likely because you posted 2x fewer reels than your average. Reels drive 60% of your discovery.")
- **Audience drift**: compare demographic snapshots week-over-week, flag meaningful shifts ("Your 18-24 segment grew from 15% to 22% — your recent reel content is attracting younger followers")
- **Competitor movements**: flag significant changes in competitor metrics or strategy

#### Weekly brief

Claude generates a narrative brief stored as `brand_weekly_brief`:

```
{
  brief_date: date,
  brand_ig_id: string,
  
  // Narrative sections
  headline: string,           // "Reel reach up 40%, but saves declining — here's why"
  whats_working: string,      // 2-3 sentences
  whats_not: string,          // 2-3 sentences  
  competitor_moves: string,   // Notable changes
  audience_shift: string,     // Demographic changes (or "stable")
  recommended_moves: string,  // Summary feeding into proposals
  
  // Key metrics with deltas
  metrics: Array<{
    metric: string,
    current: number,
    previous: number,
    delta_pct: number,
    trend: 'up' | 'down' | 'stable'
  }>
}
```

### Layer 3: Action Engine (the co-pilot)

Generates concrete proposals stored in `brand_action_proposals`, each with a status (`pending` / `approved` / `rejected` / `expired`).

#### Proposal types

**Content proposals** (`type: 'content'`):
- 5 per week
- Each contains: `title`, `format` (REEL/CAROUSEL/IMAGE), `hook` (opening line), `caption_draft` (full caption), `hashtags` (array), `optimal_time` (ISO datetime based on audience online data + historical performance), `reasoning` (why this content, why this time, what audience segment), `content_pillar` (which pillar it maps to)
- Informed by: content performance matrix, audience portrait, competitor gaps, trending signals

**Creator match proposals** (`type: 'creator_match'`):
- Wagwan users: deep match using identity graphs. Fields: `creator_google_sub`, `name`, `handle`, `followers`, `match_score`, `match_reasoning`, `audience_overlap_signals`, `aesthetic_alignment`, `suggested_message`
- External creators: discovered via hashtag/niche analysis of the brand's top-performing content themes. Fields: `ig_username`, `followers` (estimated from public profile), `match_reasoning`, `content_themes`, `suggested_message`, `profile_url` (deep link)
- Suggested message is personalized: references the creator's recent content, explains why the collaboration makes sense, written in the brand's voice (from voice guidelines)

**Strategy proposals** (`type: 'strategy'`):
- Generated when trajectory data shows a meaningful pattern
- Examples:
  - "Shift content mix from 60% images to 60% reels — your reels get 3.2x more reach"
  - "Your 25-34 female segment in Mumbai is your fastest growing audience. Create a carousel series targeting their interests: sustainable fashion + local finds"
  - "Competitor @X just started posting daily reels. Consider increasing your reel frequency from 2/week to 4/week to maintain discovery share"
- Each has: `title`, `description`, `reasoning`, `data_backing` (the metrics that triggered this), `urgency` ('high' / 'medium' / 'low')

#### Proposal lifecycle

1. Cron generates proposals weekly
2. Brand sees them on the dashboard as "Pending Moves"
3. Brand approves or rejects each one
4. Approved content proposals can be sent to the content plan generator for scheduling
5. Approved creator matches show the "Copy & Send" outreach flow
6. Approved strategy proposals get logged as active strategies (influence future analysis)
7. Proposals expire after 2 weeks if not acted on

### Data Store (Supabase tables)

```sql
-- Weekly intelligence snapshots
brand_snapshots (
  id UUID PK,
  brand_ig_id TEXT FK -> brand_accounts,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,           -- all numeric metrics
  demographics JSONB,               -- audience breakdown
  content_performance JSONB,        -- format/archetype analysis
  competitor_data JSONB,            -- competitor snapshots
  intelligence JSONB,               -- full 8-phase Claude output
  created_at TIMESTAMPTZ
)

-- Weekly narrative briefs
brand_weekly_briefs (
  id UUID PK,
  brand_ig_id TEXT FK -> brand_accounts,
  brief_date DATE NOT NULL,
  headline TEXT NOT NULL,
  sections JSONB NOT NULL,          -- whats_working, whats_not, etc.
  key_metrics JSONB NOT NULL,       -- metrics with deltas
  created_at TIMESTAMPTZ
)

-- Action proposals
brand_action_proposals (
  id UUID PK,
  brand_ig_id TEXT FK -> brand_accounts,
  type TEXT NOT NULL,               -- 'content' | 'creator_match' | 'strategy'
  status TEXT DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected' | 'expired'
  title TEXT NOT NULL,
  payload JSONB NOT NULL,           -- type-specific data
  reasoning TEXT,
  urgency TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ
)

-- Competitor tracking
brand_competitors (
  id UUID PK,
  brand_ig_id TEXT FK -> brand_accounts,
  competitor_ig_username TEXT NOT NULL,
  competitor_ig_id TEXT,            -- resolved on first fetch
  last_analysed_at TIMESTAMPTZ,
  latest_analysis JSONB,           -- lightweight Claude analysis
  created_at TIMESTAMPTZ
)
```

### API surface

All endpoints scoped to the authenticated brand's `ig_user_id`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brand/intelligence` | GET | Latest full intelligence (from most recent snapshot) |
| `/api/brand/intelligence/refresh` | POST | Trigger a manual re-analysis (outside weekly cron) |
| `/api/brand/intelligence/trajectory` | GET | Historical snapshots + computed trends (last 12 weeks) |
| `/api/brand/intelligence/audience` | GET | Demographics + audience portrait + personas |
| `/api/brand/intelligence/content-matrix` | GET | Content performance by format/archetype/objective |
| `/api/brand/intelligence/competitors` | GET | Competitive analysis + matrix |
| `/api/brand/intelligence/competitors` | POST | Add a competitor handle |
| `/api/brand/intelligence/competitors/:handle` | DELETE | Remove a competitor |
| `/api/brand/intelligence/brief` | GET | Latest weekly brief |
| `/api/brand/intelligence/briefs` | GET | All briefs (paginated, for history) |
| `/api/brand/intelligence/proposals` | GET | Pending action proposals |
| `/api/brand/intelligence/proposals/:id` | PATCH | Approve or reject (body: `{ status: 'approved' | 'rejected' }`) |
| `/api/cron/brand-intelligence` | POST | Weekly cron entry point |

### Chat integration

The existing Wagwan AI chat (`/chat/[id]`) can query brand intelligence when the user is in "brand mode". The chat's context builder (`$lib/server/ai.ts`) should:

- Detect when the conversation is about brand strategy (user asks about posting, content, audience, competitors)
- Fetch the latest `brand_snapshot` + `brand_weekly_brief` + pending `brand_action_proposals`
- Include this as context in the Claude prompt so the chat can answer questions like:
  - "What should I post this week?" — references content proposals
  - "Who should I collaborate with in Bangalore?" — queries creator matches filtered by location
  - "How did my reels perform last month?" — pulls from trajectory data
  - "What's @competitor doing differently?" — references competitor analysis

This does not require a new chat mode — it's additional context injected into the existing brand chat when relevant signals are detected in the user's message.

### Creator-facing integration

When a creator on the Wagwan app is matched with a brand (via the existing creator marketplace), the match card should show intelligence-backed context:

- Why they were matched (from the proposal's `match_reasoning`)
- The brand's content pillars (so the creator knows what kind of content to pitch)
- The brand's audience profile summary (so the creator can tailor their pitch)

This data comes from the same `brand_action_proposals` table (type: `creator_match`) and the `brand_snapshots.intelligence` field.

### Cron flow

The weekly cron (`POST /api/cron/brand-intelligence`) executes for each active brand account:

1. **Fetch** — pull all Instagram data (profile, insights, last 25 posts with per-post insights, competitor public data)
2. **Analyse** — run the 8-phase Claude pipeline + competitor analysis
3. **Snapshot** — store the full analysis in `brand_snapshots`
4. **Compare** — compute deltas against previous snapshot, detect trends/anomalies
5. **Brief** — Claude generates the weekly narrative brief, stored in `brand_weekly_briefs`
6. **Propose** — Claude generates action proposals (content ideas, creator matches, strategy adjustments), stored in `brand_action_proposals`
7. **Expire** — mark proposals older than 2 weeks as `expired`

Estimated runtime per brand: 30-60 seconds (mostly Claude inference). Should handle 50+ brands per cron run with reasonable Anthropic API usage.

### What this does NOT include (future sub-projects)

- **Content generation from assets** — uploading images/videos and having the agent generate optimized captions, hashtags, and scheduling. This is Sub-project B, built on top of the intelligence layer.
- **Auto-DM sending** — Instagram API doesn't support cold outreach. Outreach is copy-and-send.
- **Cross-platform** — this spec is Instagram-only. TikTok/YouTube/LinkedIn would follow the same agent pattern but with different API integrations.
- **Billing/usage limits** — no metering on analysis runs or proposal counts.

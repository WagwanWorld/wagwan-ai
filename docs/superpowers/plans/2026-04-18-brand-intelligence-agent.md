# Brand Intelligence Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent brand intelligence agent that deeply analyses Instagram accounts via the full Graph API, tracks trajectory weekly, analyses competitors, and proposes strategic moves — all stored in Supabase and queryable by any surface in the app.

**Architecture:** A new `brandIntelligence.ts` server module orchestrates data fetching (Instagram insights, per-post metrics, demographics) and an 8-phase Claude pipeline. A weekly cron stores snapshots, computes trends, generates briefs and action proposals. API endpoints serve the stored intelligence to the dashboard, chat, and creator-facing surfaces.

**Tech Stack:** SvelteKit, Instagram Graph API v25.0, Anthropic Claude (sonnet for analysis), Supabase (persistence), Vercel Cron.

---

## File Structure

| File | Role |
|------|------|
| `supabase/migrations/20260418000000_brand_intelligence.sql` | New tables: `brand_snapshots`, `brand_weekly_briefs`, `brand_action_proposals`, `brand_competitors` |
| `src/lib/server/brandIntelligence.ts` | Core engine: Instagram data fetching (insights, per-post metrics, demographics), 8-phase Claude pipeline, snapshot creation |
| `src/lib/server/brandTrajectory.ts` | Trend computation: week-over-week deltas, anomaly detection, audience drift |
| `src/lib/server/brandProposals.ts` | Action engine: generates content/creator/strategy proposals via Claude |
| `src/lib/server/brandCompetitors.ts` | Competitor analysis: fetch public data, run lightweight Claude analysis, build competitive matrix |
| `src/routes/api/brand/intelligence/+server.ts` | GET latest intelligence |
| `src/routes/api/brand/intelligence/refresh/+server.ts` | POST trigger manual re-analysis |
| `src/routes/api/brand/intelligence/trajectory/+server.ts` | GET historical snapshots + trends |
| `src/routes/api/brand/intelligence/audience/+server.ts` | GET demographics + audience portrait |
| `src/routes/api/brand/intelligence/content-matrix/+server.ts` | GET content performance analysis |
| `src/routes/api/brand/intelligence/competitors/+server.ts` | GET/POST competitors |
| `src/routes/api/brand/intelligence/brief/+server.ts` | GET latest weekly brief |
| `src/routes/api/brand/intelligence/proposals/+server.ts` | GET pending proposals |
| `src/routes/api/brand/intelligence/proposals/[id]/+server.ts` | PATCH approve/reject |
| `src/routes/api/cron/brand-intelligence/+server.ts` | Weekly cron entry point |
| `vercel.json` | Add cron schedule |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260418000000_brand_intelligence.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Brand intelligence agent tables
-- Stores weekly snapshots, briefs, proposals, and competitor tracking

-- Weekly intelligence snapshots
CREATE TABLE IF NOT EXISTS brand_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  snapshot_date  DATE NOT NULL,
  
  -- Account metrics
  followers      INTEGER DEFAULT 0,
  following      INTEGER DEFAULT 0,
  media_count    INTEGER DEFAULT 0,
  impressions_7d INTEGER DEFAULT 0,
  reach_7d       INTEGER DEFAULT 0,
  profile_views_7d INTEGER DEFAULT 0,
  
  -- Engagement metrics
  engagement_rate  NUMERIC(5,2) DEFAULT 0,
  avg_likes        NUMERIC(10,2) DEFAULT 0,
  avg_comments     NUMERIC(10,2) DEFAULT 0,
  avg_saves        NUMERIC(10,2) DEFAULT 0,
  avg_shares       NUMERIC(10,2) DEFAULT 0,
  avg_reach        NUMERIC(10,2) DEFAULT 0,
  posts_per_week   NUMERIC(5,1) DEFAULT 0,
  
  -- JSONB blobs
  demographics     JSONB DEFAULT '{}',
  content_performance JSONB DEFAULT '{}',
  competitor_data  JSONB DEFAULT '{}',
  intelligence     JSONB DEFAULT '{}',
  
  created_at     TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(brand_ig_id, snapshot_date)
);
CREATE INDEX idx_bs_brand_date ON brand_snapshots(brand_ig_id, snapshot_date DESC);

-- Weekly narrative briefs
CREATE TABLE IF NOT EXISTS brand_weekly_briefs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  brief_date    DATE NOT NULL,
  headline      TEXT NOT NULL DEFAULT '',
  sections      JSONB NOT NULL DEFAULT '{}',
  key_metrics   JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(brand_ig_id, brief_date)
);
CREATE INDEX idx_bwb_brand_date ON brand_weekly_briefs(brand_ig_id, brief_date DESC);

-- Action proposals
CREATE TABLE IF NOT EXISTS brand_action_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('content', 'creator_match', 'strategy')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  title         TEXT NOT NULL DEFAULT '',
  payload       JSONB NOT NULL DEFAULT '{}',
  reasoning     TEXT DEFAULT '',
  urgency       TEXT DEFAULT 'medium' CHECK (urgency IN ('high', 'medium', 'low')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  acted_at      TIMESTAMPTZ
);
CREATE INDEX idx_bap_brand_status ON brand_action_proposals(brand_ig_id, status);
CREATE INDEX idx_bap_pending ON brand_action_proposals(brand_ig_id, created_at DESC) WHERE status = 'pending';

-- Competitor tracking
CREATE TABLE IF NOT EXISTS brand_competitors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id           TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  competitor_ig_username TEXT NOT NULL,
  competitor_ig_id      TEXT,
  last_analysed_at      TIMESTAMPTZ,
  latest_analysis       JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(brand_ig_id, competitor_ig_username)
);
CREATE INDEX idx_bc_brand ON brand_competitors(brand_ig_id);

-- Add brand_identity column if not exists (may already exist from prior migration)
DO $$ BEGIN
  ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS brand_identity JSONB DEFAULT '{}';
  ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS identity_updated_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS
ALTER TABLE brand_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_weekly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_competitors ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/madhviknemani/wagwan-ai && npx supabase db push 2>&1 | tail -5
```

If supabase CLI isn't configured for remote, apply via the Supabase dashboard SQL editor instead.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260418000000_brand_intelligence.sql
git commit -m "feat(brand): add intelligence agent database tables"
```

---

## Task 2: Core Intelligence Engine — Instagram Data Fetching

**Files:**
- Create: `src/lib/server/brandIntelligence.ts`

This is the core data layer. It fetches all available Instagram metrics and runs the 8-phase Claude pipeline.

- [ ] **Step 1: Create the intelligence engine**

```typescript
// src/lib/server/brandIntelligence.ts
//
// Core brand intelligence engine.
// Fetches all Instagram metrics (account insights, per-post insights, demographics)
// and runs an 8-phase Claude analysis pipeline.

import Anthropic from '@anthropic-ai/sdk';
import {
  fetchInstagramProfile,
  fetchInstagramMedia,
  analyseInstagramIdentity,
  type InstagramProfile,
  type InstagramMedia,
} from './instagram';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccountInsights {
  impressions7d: number;
  reach7d: number;
  profileViews7d: number;
  onlineFollowers: Record<string, number[]> | null; // day -> 24 hourly values
}

export interface PostInsight {
  mediaId: string;
  mediaType: string;
  timestamp: string;
  caption: string;
  permalink: string;
  thumbnail: string;
  likes: number;
  comments: number;
  impressions: number;
  reach: number;
  saved: number;
  shares: number;
  videoViews: number;
  engagement: number; // likes + comments + saves + shares
}

export interface AudienceDemographics {
  ageBuckets: Record<string, number>;   // e.g. "18-24": 0.22
  genderSplit: { male: number; female: number; unknown: number };
  topCities: Array<{ city: string; pct: number }>;
  topCountries: Array<{ country: string; pct: number }>;
}

export interface ContentPerformance {
  formatBreakdown: Record<string, {
    count: number;
    avgReach: number;
    avgSaves: number;
    avgShares: number;
    avgEngagement: number;
  }>;
  topPostIds: string[];
  bottomPostIds: string[];
  contentArchetypes: Array<{
    archetype: string;
    description: string;
    avgReach: number;
    avgSaves: number;
    bestFormat: string;
    examplePostIds: string[];
  }>;
  reachDrivers: string;
  saveDrivers: string;
  shareDrivers: string;
}

export interface AudiencePortrait {
  narrative: string;
  primaryDemographic: {
    ageRange: string;
    gender: string;
    topCities: string[];
    topCountries: string[];
  };
  personas: Array<{ name: string; description: string }>;
}

export interface StrategicPositioning {
  brandDirection: string;
  contentPillars: string[];
  voiceGuidelines: string;
  competitiveGaps: string;
  bigBet: string;
  quickWins: string[];
}

export interface BrandIntelligenceResult {
  profile: InstagramProfile;
  postInsights: PostInsight[];
  accountInsights: AccountInsights;
  demographics: AudienceDemographics;
  contentPerformance: ContentPerformance;
  audiencePortrait: AudiencePortrait;
  strategicPositioning: StrategicPositioning;
  identity: Record<string, unknown>; // full Phase 1-5 identity
  postingHeatmap: Array<{ day: number; hour: number; avg: number }>;
  bestHours: Array<{ hour: number; avgEng: number }>;
  bestDays: Array<{ day: string; avgEng: number }>;
  topHashtags: Array<{ tag: string; count: number }>;
  engagementRate: number;
  avgPerPost: number;
  postsPerWeek: number;
  growthTrend: number;
}

// ── Instagram API fetchers ─────────────────────────────────────────────────

/** Fetch account-level insights (impressions, reach, profile_views) */
export async function fetchAccountInsights(
  igUserId: string,
  token: string,
): Promise<AccountInsights> {
  const result: AccountInsights = {
    impressions7d: 0,
    reach7d: 0,
    profileViews7d: 0,
    onlineFollowers: null,
  };

  // Daily metrics for last 30 days
  const metricsToFetch = ['impressions', 'reach', 'profile_views'];
  for (const metric of metricsToFetch) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=${metric}&period=day&since=${Math.floor(Date.now() / 1000) - 7 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`,
      );
      if (res.ok) {
        const data = await res.json();
        const values = data?.data?.[0]?.values || [];
        const sum = values.reduce((s: number, v: { value: number }) => s + (v.value || 0), 0);
        if (metric === 'impressions') result.impressions7d = sum;
        if (metric === 'reach') result.reach7d = sum;
        if (metric === 'profile_views') result.profileViews7d = sum;
      }
    } catch {
      // Metric not available for this account type — skip
    }
  }

  // Online followers (lifetime, hourly breakdown by day)
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
    );
    if (res.ok) {
      const data = await res.json();
      result.onlineFollowers = data?.data?.[0]?.values?.[0]?.value || null;
    }
  } catch {}

  return result;
}

/** Fetch audience demographics (age, gender, city, country) */
export async function fetchDemographics(
  igUserId: string,
  token: string,
): Promise<AudienceDemographics> {
  const result: AudienceDemographics = {
    ageBuckets: {},
    genderSplit: { male: 0, female: 0, unknown: 0 },
    topCities: [],
    topCountries: [],
  };

  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender,city,country&access_token=${token}`,
    );
    if (!res.ok) return result;
    const data = await res.json();
    const metrics = data?.data || [];

    for (const metric of metrics) {
      const breakdowns = metric?.total_value?.breakdowns || [];
      for (const bd of breakdowns) {
        const dimensions = bd.dimension_keys || [];
        const results = bd.results || [];

        if (dimensions.includes('age')) {
          for (const r of results) {
            const age = r.dimension_values?.[dimensions.indexOf('age')] || 'unknown';
            result.ageBuckets[age] = (result.ageBuckets[age] || 0) + (r.value || 0);
          }
        }
        if (dimensions.includes('gender')) {
          for (const r of results) {
            const gender = r.dimension_values?.[dimensions.indexOf('gender')] || 'U';
            if (gender === 'M') result.genderSplit.male += r.value || 0;
            else if (gender === 'F') result.genderSplit.female += r.value || 0;
            else result.genderSplit.unknown += r.value || 0;
          }
        }
        if (dimensions.includes('city')) {
          const cities: Record<string, number> = {};
          for (const r of results) {
            const city = r.dimension_values?.[dimensions.indexOf('city')] || 'unknown';
            cities[city] = (cities[city] || 0) + (r.value || 0);
          }
          result.topCities = Object.entries(cities)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([city, count]) => ({ city, pct: count }));
        }
        if (dimensions.includes('country')) {
          const countries: Record<string, number> = {};
          for (const r of results) {
            const country = r.dimension_values?.[dimensions.indexOf('country')] || 'unknown';
            countries[country] = (countries[country] || 0) + (r.value || 0);
          }
          result.topCountries = Object.entries(countries)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country, count]) => ({ country, pct: count }));
        }
      }
    }

    // Normalize demographics to percentages
    const totalAge = Object.values(result.ageBuckets).reduce((s, v) => s + v, 0);
    if (totalAge > 0) {
      for (const key of Object.keys(result.ageBuckets)) {
        result.ageBuckets[key] = +(result.ageBuckets[key] / totalAge * 100).toFixed(1);
      }
    }
    const totalGender = result.genderSplit.male + result.genderSplit.female + result.genderSplit.unknown;
    if (totalGender > 0) {
      result.genderSplit.male = +(result.genderSplit.male / totalGender * 100).toFixed(1);
      result.genderSplit.female = +(result.genderSplit.female / totalGender * 100).toFixed(1);
      result.genderSplit.unknown = +(result.genderSplit.unknown / totalGender * 100).toFixed(1);
    }
    const totalCities = result.topCities.reduce((s, c) => s + c.pct, 0);
    if (totalCities > 0) {
      result.topCities = result.topCities.map(c => ({ ...c, pct: +(c.pct / totalCities * 100).toFixed(1) }));
    }
    const totalCountries = result.topCountries.reduce((s, c) => s + c.pct, 0);
    if (totalCountries > 0) {
      result.topCountries = result.topCountries.map(c => ({ ...c, pct: +(c.pct / totalCountries * 100).toFixed(1) }));
    }
  } catch {
    // Demographics not available — requires business account with 100+ followers
  }

  return result;
}

/** Fetch per-post insights (impressions, reach, saved, shares) for an array of media */
export async function fetchPostInsights(
  posts: InstagramMedia[],
  token: string,
): Promise<PostInsight[]> {
  const insights: PostInsight[] = [];

  for (const post of posts.slice(0, 25)) {
    const base: PostInsight = {
      mediaId: post.id,
      mediaType: post.media_type,
      timestamp: post.timestamp,
      caption: (post.caption || '').slice(0, 200),
      permalink: post.permalink || '',
      thumbnail: post.thumbnail_url || post.media_url || '',
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      impressions: 0,
      reach: 0,
      saved: 0,
      shares: 0,
      videoViews: 0,
      engagement: (post.like_count || 0) + (post.comments_count || 0),
    };

    try {
      // Different metrics for different media types
      const isVideo = ['VIDEO', 'REELS'].includes(post.media_type);
      const metrics = isVideo
        ? 'impressions,reach,saved,shares,plays'
        : 'impressions,reach,saved,shares';

      const res = await fetch(
        `https://graph.instagram.com/v25.0/${post.id}/insights?metric=${metrics}&access_token=${token}`,
      );
      if (res.ok) {
        const data = await res.json();
        for (const m of data?.data || []) {
          const val = m.values?.[0]?.value || 0;
          if (m.name === 'impressions') base.impressions = val;
          if (m.name === 'reach') base.reach = val;
          if (m.name === 'saved') base.saved = val;
          if (m.name === 'shares') base.shares = val;
          if (m.name === 'plays') base.videoViews = val;
        }
        base.engagement = base.likes + base.comments + base.saved + base.shares;
      }
    } catch {
      // Per-post insights not available — keep basic metrics
    }

    insights.push(base);
  }

  return insights;
}

// ── Computation helpers ────────────────────────────────────────────────────

export function computePostingHeatmap(posts: PostInsight[]) {
  const hourDayMap: Record<string, { total: number; count: number }> = {};
  const hourMap: Record<number, { total: number; count: number }> = {};
  const dayMap: Record<number, { total: number; count: number }> = {};

  for (const p of posts) {
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

  const heatmap = Object.entries(hourDayMap).map(([key, v]) => {
    const [d, h] = key.split('-').map(Number);
    return { day: d, hour: h, avg: Math.round(v.total / v.count) };
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bestHours = Object.entries(hourMap)
    .map(([h, v]) => ({ hour: +h, avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 5);

  const bestDays = Object.entries(dayMap)
    .map(([d, v]) => ({ day: dayNames[+d], avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  return { heatmap, bestHours, bestDays };
}

export function computeHashtags(posts: InstagramMedia[]) {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const tags = (p.caption || '').match(/#[\w]+/g) || [];
    for (const t of tags) {
      const lower = t.toLowerCase();
      counts[lower] = (counts[lower] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));
}

export function computeFormatBreakdown(posts: PostInsight[]) {
  const breakdown: Record<string, { count: number; totalReach: number; totalSaves: number; totalShares: number; totalEng: number }> = {};
  for (const p of posts) {
    if (!breakdown[p.mediaType]) breakdown[p.mediaType] = { count: 0, totalReach: 0, totalSaves: 0, totalShares: 0, totalEng: 0 };
    breakdown[p.mediaType].count += 1;
    breakdown[p.mediaType].totalReach += p.reach;
    breakdown[p.mediaType].totalSaves += p.saved;
    breakdown[p.mediaType].totalShares += p.shares;
    breakdown[p.mediaType].totalEng += p.engagement;
  }
  const result: ContentPerformance['formatBreakdown'] = {};
  for (const [type, v] of Object.entries(breakdown)) {
    result[type] = {
      count: v.count,
      avgReach: Math.round(v.totalReach / v.count),
      avgSaves: Math.round(v.totalSaves / v.count),
      avgShares: Math.round(v.totalShares / v.count),
      avgEngagement: Math.round(v.totalEng / v.count),
    };
  }
  return result;
}

export function computeGrowthTrend(posts: PostInsight[]): number {
  const half = Math.floor(posts.length / 2);
  if (half === 0) return 0;
  const recentAvg = posts.slice(0, half).reduce((s, p) => s + p.engagement, 0) / half;
  const olderAvg = posts.slice(half).reduce((s, p) => s + p.engagement, 0) / (posts.length - half);
  return olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
}

// ── Phase 6: Audience Portrait (Claude) ────────────────────────────────────

export async function analyseAudiencePortrait(
  demographics: AudienceDemographics,
  profile: InstagramProfile,
  postInsights: PostInsight[],
  apiKey: string,
): Promise<AudiencePortrait> {
  const fallback: AudiencePortrait = {
    narrative: 'Audience data not yet available. Requires a business account with 100+ followers.',
    primaryDemographic: { ageRange: 'unknown', gender: 'unknown', topCities: [], topCountries: [] },
    personas: [],
  };

  const hasDemo = Object.keys(demographics.ageBuckets).length > 0;
  if (!hasDemo) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a brand strategist. Analyse this Instagram audience data and return ONLY valid JSON.

Account: @${profile.username} — ${profile.name || ''} (${profile.followers_count || 0} followers)
Bio: ${profile.biography || 'none'}

Age distribution: ${JSON.stringify(demographics.ageBuckets)}
Gender: Male ${demographics.genderSplit.male}%, Female ${demographics.genderSplit.female}%
Top cities: ${demographics.topCities.map(c => `${c.city} (${c.pct}%)`).join(', ')}
Top countries: ${demographics.topCountries.map(c => `${c.country} (${c.pct}%)`).join(', ')}
Avg saves per post: ${Math.round(postInsights.reduce((s, p) => s + p.saved, 0) / (postInsights.length || 1))}
Avg shares per post: ${Math.round(postInsights.reduce((s, p) => s + p.shares, 0) / (postInsights.length || 1))}

Return:
{
  "narrative": "2-3 sentence audience portrait describing who follows this brand, their likely motivations, and when they're most active",
  "primaryDemographic": { "ageRange": "25-34", "gender": "predominantly female", "topCities": ["city1","city2"], "topCountries": ["country1"] },
  "personas": [
    { "name": "persona name", "description": "1-2 sentence behavioral description" },
    { "name": "persona name", "description": "1-2 sentence behavioral description" }
  ]
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ── Phase 7: Content Performance Matrix (Claude) ───────────────────────────

export async function analyseContentMatrix(
  postInsights: PostInsight[],
  profile: InstagramProfile,
  formatBreakdown: ContentPerformance['formatBreakdown'],
  apiKey: string,
): Promise<Pick<ContentPerformance, 'contentArchetypes' | 'reachDrivers' | 'saveDrivers' | 'shareDrivers'>> {
  const fallback = { contentArchetypes: [], reachDrivers: '', saveDrivers: '', shareDrivers: '' };
  if (postInsights.length < 3) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const postSummary = postInsights
      .slice(0, 15)
      .map((p, i) => `${i + 1}. [${p.mediaType}] reach=${p.reach} saves=${p.saved} shares=${p.shares} eng=${p.engagement} — "${p.caption.slice(0, 120)}"`)
      .join('\n');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyse this brand's content performance. Return ONLY valid JSON.

@${profile.username} — ${profile.followers_count} followers
Format breakdown: ${JSON.stringify(formatBreakdown)}

Post performance (sorted by engagement):
${postSummary}

Return:
{
  "contentArchetypes": [
    { "archetype": "name", "description": "what this type of content is", "avgReach": 0, "avgSaves": 0, "bestFormat": "REEL|IMAGE|CAROUSEL", "examplePostIds": [] }
  ],
  "reachDrivers": "1-2 sentences on what content drives discovery/reach",
  "saveDrivers": "1-2 sentences on what content people bookmark (purchase intent signal)",
  "shareDrivers": "1-2 sentences on what content gets shared (virality signal)"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ── Phase 8: Strategic Positioning (Claude) ────────────────────────────────

export async function analyseStrategicPositioning(
  profile: InstagramProfile,
  identity: Record<string, unknown>,
  audiencePortrait: AudiencePortrait,
  contentMatrix: Pick<ContentPerformance, 'contentArchetypes' | 'reachDrivers' | 'saveDrivers' | 'shareDrivers'>,
  competitorSummary: string,
  engagementRate: number,
  growthTrend: number,
  topHashtags: Array<{ tag: string; count: number }>,
  apiKey: string,
): Promise<StrategicPositioning> {
  const fallback: StrategicPositioning = {
    brandDirection: 'Not enough data for strategic analysis.',
    contentPillars: [],
    voiceGuidelines: '',
    competitiveGaps: '',
    bigBet: '',
    quickWins: [],
  };

  try {
    const client = new Anthropic({ apiKey });
    const identityStr = `aesthetic=${(identity as any).aesthetic || '?'}, lifestyle=${(identity as any).lifestyle || '?'}, interests=${((identity as any).interests || []).join(', ')}, brandVibes=${((identity as any).brandVibes || []).join(', ')}, captionIntent=${(identity as any).captionIntent || '?'}`;

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a senior brand strategist. Synthesise all signals and provide strategic direction. Return ONLY valid JSON.

Account: @${profile.username} — ${profile.name || ''} (${profile.followers_count} followers)
Bio: ${profile.biography || 'none'}
Engagement rate: ${engagementRate}%, Growth trend: ${growthTrend > 0 ? '+' : ''}${growthTrend}%
Identity: ${identityStr}
Audience: ${audiencePortrait.narrative}
Content drivers — Reach: ${contentMatrix.reachDrivers} | Saves: ${contentMatrix.saveDrivers} | Shares: ${contentMatrix.shareDrivers}
Top hashtags: ${topHashtags.slice(0, 8).map(h => h.tag).join(', ')}
Competitors: ${competitorSummary || 'None specified yet'}

Return:
{
  "brandDirection": "2-3 sentence strategic positioning recommendation",
  "contentPillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
  "voiceGuidelines": "2-3 sentences on tone, vocabulary, caption structure",
  "competitiveGaps": "1-2 sentences on opportunities competitors aren't covering",
  "bigBet": "One bold strategic recommendation with reasoning (2-3 sentences)",
  "quickWins": ["immediate action 1", "immediate action 2", "immediate action 3"]
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ── Full pipeline orchestrator ─────────────────────────────────────────────

export async function runBrandIntelligence(
  igUserId: string,
  token: string,
  apiKey: string,
  competitorSummary?: string,
): Promise<BrandIntelligenceResult> {
  console.log(`[Brand Intelligence] Starting full analysis for ${igUserId}`);

  // Phase 1: Fetch all data in parallel
  const [profile, media] = await Promise.all([
    fetchInstagramProfile(token),
    fetchInstagramMedia(token, 25),
  ]);

  const [accountInsights, demographics, postInsights] = await Promise.all([
    fetchAccountInsights(igUserId, token),
    fetchDemographics(igUserId, token),
    fetchPostInsights(media, token),
  ]);

  // Phase 2-5: Run existing identity pipeline
  const identity = await analyseInstagramIdentity(profile, media, token);

  // Compute deterministic metrics
  const { heatmap, bestHours, bestDays } = computePostingHeatmap(postInsights);
  const topHashtags = computeHashtags(media);
  const formatBreakdown = computeFormatBreakdown(postInsights);
  const growthTrend = computeGrowthTrend(postInsights);

  const totalEng = postInsights.reduce((s, p) => s + p.engagement, 0);
  const avgPerPost = postInsights.length ? Math.round(totalEng / postInsights.length) : 0;
  const engagementRate = profile.followers_count
    ? +((totalEng / postInsights.length) / profile.followers_count * 100).toFixed(2)
    : 0;

  let postsPerWeek = 0;
  if (media.length >= 2) {
    const newest = new Date(media[0].timestamp).getTime();
    const oldest = new Date(media[media.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((media.length / daySpan) * 7 * 10) / 10 : 0;
  }

  // Phases 6-8: Claude analyses (sequential — each builds on previous)
  const audiencePortrait = await analyseAudiencePortrait(demographics, profile, postInsights, apiKey);

  const contentMatrixResult = await analyseContentMatrix(postInsights, profile, formatBreakdown, apiKey);

  const contentPerformance: ContentPerformance = {
    formatBreakdown,
    topPostIds: [...postInsights].sort((a, b) => b.engagement - a.engagement).slice(0, 3).map(p => p.mediaId),
    bottomPostIds: [...postInsights].sort((a, b) => a.engagement - b.engagement).slice(0, 3).map(p => p.mediaId),
    ...contentMatrixResult,
  };

  const strategicPositioning = await analyseStrategicPositioning(
    profile,
    identity as unknown as Record<string, unknown>,
    audiencePortrait,
    contentMatrixResult,
    competitorSummary || '',
    engagementRate,
    growthTrend,
    topHashtags,
    apiKey,
  );

  console.log(`[Brand Intelligence] Analysis complete for @${profile.username}`);

  return {
    profile,
    postInsights,
    accountInsights,
    demographics,
    contentPerformance,
    audiencePortrait,
    strategicPositioning,
    identity: identity as unknown as Record<string, unknown>,
    postingHeatmap: heatmap,
    bestHours,
    bestDays,
    topHashtags,
    engagementRate,
    avgPerPost,
    postsPerWeek,
    growthTrend,
  };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/brandIntelligence.ts
git commit -m "feat(brand): add core intelligence engine with 8-phase pipeline"
```

---

## Task 3: Trajectory Tracking Module

**Files:**
- Create: `src/lib/server/brandTrajectory.ts`

Computes week-over-week deltas, rolling averages, anomaly flags, and audience drift.

- [ ] **Step 1: Create the trajectory module**

```typescript
// src/lib/server/brandTrajectory.ts
//
// Computes trends from brand_snapshots: week-over-week deltas,
// rolling averages, anomaly detection, audience drift.

import Anthropic from '@anthropic-ai/sdk';

export interface MetricDelta {
  metric: string;
  current: number;
  previous: number;
  deltaPct: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TrajectoryResult {
  deltas: MetricDelta[];
  anomalies: Array<{ metric: string; message: string; severity: 'high' | 'medium' }>;
  audienceDrift: string; // narrative or "stable"
  fourWeekTrends: Record<string, number[]>; // metric -> [w1, w2, w3, w4]
}

function delta(curr: number, prev: number): { deltaPct: number; trend: 'up' | 'down' | 'stable' } {
  if (prev === 0) return { deltaPct: 0, trend: 'stable' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { deltaPct: pct, trend: pct > 2 ? 'up' : pct < -2 ? 'down' : 'stable' };
}

export function computeTrajectory(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  history: Array<Record<string, unknown>>, // last 4 snapshots, newest first
): TrajectoryResult {
  const result: TrajectoryResult = {
    deltas: [],
    anomalies: [],
    audienceDrift: 'stable',
    fourWeekTrends: {},
  };

  if (!previous) return result;

  // Compute deltas for key metrics
  const metricKeys = [
    'followers', 'engagement_rate', 'avg_saves', 'avg_shares',
    'avg_reach', 'impressions_7d', 'reach_7d', 'profile_views_7d', 'posts_per_week',
  ];

  for (const key of metricKeys) {
    const curr = Number((current as any)[key] || 0);
    const prev = Number((previous as any)[key] || 0);
    const { deltaPct, trend } = delta(curr, prev);
    const label = key.replace(/_/g, ' ').replace(/7d/g, '(7d)');
    result.deltas.push({ metric: label, current: curr, previous: prev, deltaPct, trend });

    // Anomaly: >30% change in either direction
    if (Math.abs(deltaPct) > 30) {
      result.anomalies.push({
        metric: label,
        message: `${label} ${deltaPct > 0 ? 'surged' : 'dropped'} ${Math.abs(deltaPct)}% week-over-week`,
        severity: Math.abs(deltaPct) > 50 ? 'high' : 'medium',
      });
    }
  }

  // 4-week rolling trends
  for (const key of metricKeys) {
    result.fourWeekTrends[key] = history.slice(0, 4).map(s => Number((s as any)[key] || 0));
  }

  // Audience drift detection
  const currDemo = (current as any).demographics;
  const prevDemo = (previous as any).demographics;
  if (currDemo && prevDemo) {
    const currCities = (currDemo.topCities || []).map((c: any) => c.city);
    const prevCities = (prevDemo.topCities || []).map((c: any) => c.city);
    const newCities = currCities.filter((c: string) => !prevCities.includes(c));

    const currAge = currDemo.ageBuckets || {};
    const prevAge = prevDemo.ageBuckets || {};
    const ageDrifts: string[] = [];
    for (const bucket of Object.keys(currAge)) {
      const diff = (currAge[bucket] || 0) - (prevAge[bucket] || 0);
      if (Math.abs(diff) >= 3) {
        ageDrifts.push(`${bucket}: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
      }
    }

    if (newCities.length > 0 || ageDrifts.length > 0) {
      const parts: string[] = [];
      if (newCities.length > 0) parts.push(`New cities in top 10: ${newCities.join(', ')}`);
      if (ageDrifts.length > 0) parts.push(`Age shifts: ${ageDrifts.join(', ')}`);
      result.audienceDrift = parts.join('. ');
    }
  }

  return result;
}

export async function generateWeeklyBrief(
  trajectory: TrajectoryResult,
  intelligence: Record<string, unknown>,
  profile: { username: string; name: string; followers_count: number },
  apiKey: string,
): Promise<{ headline: string; sections: Record<string, string>; keyMetrics: MetricDelta[] }> {
  const fallback = {
    headline: 'Weekly intelligence update',
    sections: { whats_working: '', whats_not: '', audience_shift: trajectory.audienceDrift, competitor_moves: '', recommended_moves: '' },
    keyMetrics: trajectory.deltas,
  };

  try {
    const client = new Anthropic({ apiKey });
    const metricsSummary = trajectory.deltas
      .filter(d => d.trend !== 'stable')
      .map(d => `${d.metric}: ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}% (${d.previous} → ${d.current})`)
      .join('\n');

    const anomalySummary = trajectory.anomalies.length > 0
      ? trajectory.anomalies.map(a => `[${a.severity}] ${a.message}`).join('\n')
      : 'No anomalies this week.';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Write a weekly brand intelligence brief. Return ONLY valid JSON.

Brand: @${profile.username} — ${profile.name} (${profile.followers_count} followers)

Metric changes this week:
${metricsSummary || 'All metrics stable.'}

Anomalies:
${anomalySummary}

Audience drift: ${trajectory.audienceDrift}

Return:
{
  "headline": "Punchy 1-line headline summarising the week (like a magazine headline)",
  "sections": {
    "whats_working": "2-3 sentences on positive trends",
    "whats_not": "2-3 sentences on concerns or declining metrics",
    "audience_shift": "1-2 sentences on demographic changes or 'Audience composition stable this week'",
    "competitor_moves": "1-2 sentences or 'No competitor data yet'",
    "recommended_moves": "2-3 bullet-point recommendations"
  }
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(text);
    return { ...parsed, keyMetrics: trajectory.deltas };
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/brandTrajectory.ts
git commit -m "feat(brand): add trajectory tracking with trend detection and weekly briefs"
```

---

## Task 4: Competitor Analysis Module

**Files:**
- Create: `src/lib/server/brandCompetitors.ts`

Fetches public data for competitor accounts and runs lightweight Claude analysis.

- [ ] **Step 1: Create the competitors module**

```typescript
// src/lib/server/brandCompetitors.ts
//
// Competitor analysis: fetch public profile + posts,
// run lightweight Claude analysis, build competitive matrix.

import Anthropic from '@anthropic-ai/sdk';

export interface CompetitorProfile {
  username: string;
  name: string;
  biography: string;
  followers: number;
  mediaCount: number;
  profilePicture: string;
}

export interface CompetitorAnalysis {
  username: string;
  followers: number;
  engagementRate: number;
  postsPerWeek: number;
  aesthetic: string;
  contentThemes: string[];
  hashtagStrategy: string[];
  formatMix: Record<string, number>; // e.g. { REEL: 40, IMAGE: 35, CAROUSEL: 25 }
  summary: string;
}

export interface CompetitiveMatrix {
  competitors: CompetitorAnalysis[];
  overlaps: string;
  gaps: string;
  positioning: string;
}

/**
 * Fetch a public Instagram profile by user ID.
 * Note: discovering user IDs from usernames requires the Facebook Business API
 * or ig_username search. For now, if we only have a username, we store it
 * and resolve the ID on first analysis via the brand's token.
 */
export async function fetchCompetitorData(
  competitorIgId: string,
  brandToken: string,
): Promise<{ profile: CompetitorProfile; posts: Array<{ caption: string; mediaType: string; timestamp: string; likes: number; comments: number }> } | null> {
  try {
    // Fetch profile
    const profileRes = await fetch(
      `https://graph.instagram.com/v25.0/${competitorIgId}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count&access_token=${brandToken}`,
    );
    if (!profileRes.ok) return null;
    const p = await profileRes.json();

    // Fetch recent posts
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${competitorIgId}/media?fields=caption,media_type,timestamp,like_count,comments_count&limit=12&access_token=${brandToken}`,
    );
    const mediaData = mediaRes.ok ? await mediaRes.json() : { data: [] };

    return {
      profile: {
        username: p.username || '',
        name: p.name || '',
        biography: p.biography || '',
        followers: p.followers_count || 0,
        mediaCount: p.media_count || 0,
        profilePicture: p.profile_picture_url || '',
      },
      posts: (mediaData.data || []).map((m: any) => ({
        caption: (m.caption || '').slice(0, 200),
        mediaType: m.media_type || 'IMAGE',
        timestamp: m.timestamp || '',
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
      })),
    };
  } catch {
    return null;
  }
}

export async function analyseCompetitor(
  data: NonNullable<Awaited<ReturnType<typeof fetchCompetitorData>>>,
  apiKey: string,
): Promise<CompetitorAnalysis> {
  const { profile, posts } = data;

  // Deterministic metrics
  const totalEng = posts.reduce((s, p) => s + p.likes + p.comments, 0);
  const engagementRate = profile.followers > 0 && posts.length > 0
    ? +((totalEng / posts.length) / profile.followers * 100).toFixed(2)
    : 0;

  let postsPerWeek = 0;
  if (posts.length >= 2) {
    const newest = new Date(posts[0].timestamp).getTime();
    const oldest = new Date(posts[posts.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((posts.length / daySpan) * 7 * 10) / 10 : 0;
  }

  const formatCounts: Record<string, number> = {};
  for (const p of posts) {
    formatCounts[p.mediaType] = (formatCounts[p.mediaType] || 0) + 1;
  }
  const formatMix: Record<string, number> = {};
  for (const [type, count] of Object.entries(formatCounts)) {
    formatMix[type] = Math.round((count / posts.length) * 100);
  }

  // Claude analysis
  let aesthetic = 'unknown';
  let contentThemes: string[] = [];
  let hashtagStrategy: string[] = [];
  let summary = '';

  try {
    const client = new Anthropic({ apiKey });
    const captionSample = posts.slice(0, 6).map((p, i) =>
      `${i + 1}. [${p.mediaType}] ${p.likes} likes — "${p.caption}"`
    ).join('\n');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Briefly analyse this Instagram competitor. Return ONLY valid JSON.

@${profile.username} — ${profile.name} (${profile.followers} followers)
Bio: ${profile.biography}
Engagement rate: ${engagementRate}%
Format mix: ${JSON.stringify(formatMix)}

Captions:
${captionSample}

Return:
{
  "aesthetic": "one word (minimal/bold/playful/editorial/raw/polished)",
  "contentThemes": ["theme1", "theme2", "theme3"],
  "hashtagStrategy": ["top hashtag pattern 1", "pattern 2"],
  "summary": "2 sentence competitive summary"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(text);
    aesthetic = parsed.aesthetic || aesthetic;
    contentThemes = parsed.contentThemes || contentThemes;
    hashtagStrategy = parsed.hashtagStrategy || hashtagStrategy;
    summary = parsed.summary || summary;
  } catch {}

  return {
    username: profile.username,
    followers: profile.followers,
    engagementRate,
    postsPerWeek,
    aesthetic,
    contentThemes,
    hashtagStrategy,
    formatMix,
    summary,
  };
}

export async function buildCompetitiveMatrix(
  brandProfile: { username: string; followers_count: number; engagement_rate: number },
  competitors: CompetitorAnalysis[],
  apiKey: string,
): Promise<CompetitiveMatrix> {
  const matrix: CompetitiveMatrix = {
    competitors,
    overlaps: '',
    gaps: '',
    positioning: '',
  };

  if (competitors.length === 0) return matrix;

  try {
    const client = new Anthropic({ apiKey });
    const compSummary = competitors.map(c =>
      `@${c.username}: ${c.followers} followers, ${c.engagementRate}% eng, aesthetic=${c.aesthetic}, themes=${c.contentThemes.join('/')}`
    ).join('\n');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Compare this brand against its competitors. Return ONLY valid JSON.

Brand: @${brandProfile.username} (${brandProfile.followers_count} followers, ${brandProfile.engagement_rate}% engagement)

Competitors:
${compSummary}

Return:
{
  "overlaps": "1-2 sentences on where the brand and competitors overlap in content/audience",
  "gaps": "1-2 sentences on niches or formats competitors aren't covering that the brand could own",
  "positioning": "2-3 sentences on how the brand should position against these competitors"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(text);
    matrix.overlaps = parsed.overlaps || '';
    matrix.gaps = parsed.gaps || '';
    matrix.positioning = parsed.positioning || '';
  } catch {}

  return matrix;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/brandCompetitors.ts
git commit -m "feat(brand): add competitor analysis module"
```

---

## Task 5: Action Proposals Module

**Files:**
- Create: `src/lib/server/brandProposals.ts`

Generates content, creator match, and strategy proposals from intelligence data.

- [ ] **Step 1: Create the proposals module**

```typescript
// src/lib/server/brandProposals.ts
//
// Action engine: generates content ideas, creator matches,
// and strategy proposals from brand intelligence.

import Anthropic from '@anthropic-ai/sdk';
import type { BrandIntelligenceResult, AudiencePortrait, StrategicPositioning } from './brandIntelligence';
import type { TrajectoryResult, MetricDelta } from './brandTrajectory';

export interface ContentProposal {
  type: 'content';
  title: string;
  format: string;
  hook: string;
  captionDraft: string;
  hashtags: string[];
  optimalTime: string;
  contentPillar: string;
  reasoning: string;
}

export interface CreatorMatchProposal {
  type: 'creator_match';
  // Wagwan user
  creatorGoogleSub?: string;
  // External creator
  igUsername?: string;
  name: string;
  followers: number;
  matchScore?: number;
  matchReasoning: string;
  suggestedMessage: string;
  profileUrl: string;
  source: 'wagwan' | 'external';
}

export interface StrategyProposal {
  type: 'strategy';
  title: string;
  description: string;
  reasoning: string;
  dataBacking: string;
  urgency: 'high' | 'medium' | 'low';
}

export type Proposal = ContentProposal | CreatorMatchProposal | StrategyProposal;

export async function generateContentProposals(
  intelligence: BrandIntelligenceResult,
  apiKey: string,
): Promise<ContentProposal[]> {
  try {
    const client = new Anthropic({ apiKey });
    const { profile, strategicPositioning, audiencePortrait, bestHours, topHashtags, contentPerformance } = intelligence;

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Generate 5 content ideas for this brand. Return ONLY valid JSON array.

Brand: @${profile.username} — ${profile.name} (${profile.followers_count} followers)
Direction: ${strategicPositioning.brandDirection}
Pillars: ${strategicPositioning.contentPillars.join(', ')}
Voice: ${strategicPositioning.voiceGuidelines}
Audience: ${audiencePortrait.narrative}
Best format: ${Object.entries(contentPerformance.formatBreakdown).sort((a, b) => b[1].avgReach - a[1].avgReach)[0]?.[0] || 'IMAGE'}
Reach drivers: ${contentPerformance.reachDrivers}
Save drivers: ${contentPerformance.saveDrivers}
Top hashtags: ${topHashtags.slice(0, 6).map(h => h.tag).join(', ')}
Best posting hour (UTC): ${bestHours[0]?.hour ?? 14}

Return array of 5:
[{
  "title": "idea title",
  "format": "REEL|CAROUSEL|IMAGE",
  "hook": "opening hook line",
  "captionDraft": "Full caption draft (2-3 sentences + CTA)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "optimalTime": "day and time recommendation",
  "contentPillar": "which pillar this maps to",
  "reasoning": "Why this will work for their audience"
}]`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const ideas = JSON.parse(text);
    return ideas.map((idea: any) => ({ ...idea, type: 'content' as const }));
  } catch {
    return [];
  }
}

export async function generateStrategyProposals(
  trajectory: TrajectoryResult,
  intelligence: BrandIntelligenceResult,
  apiKey: string,
): Promise<StrategyProposal[]> {
  // Only generate strategy proposals when there's meaningful trajectory data
  if (trajectory.deltas.length === 0) return [];

  try {
    const client = new Anthropic({ apiKey });
    const significantDeltas = trajectory.deltas.filter(d => Math.abs(d.deltaPct) > 5);
    const anomalies = trajectory.anomalies;

    if (significantDeltas.length === 0 && anomalies.length === 0) return [];

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Based on these brand metric changes, suggest strategic adjustments. Return ONLY valid JSON array.

Brand: @${intelligence.profile.username} (${intelligence.profile.followers_count} followers)

Metric changes:
${significantDeltas.map(d => `${d.metric}: ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}% (${d.previous} → ${d.current})`).join('\n')}

Anomalies:
${anomalies.map(a => `[${a.severity}] ${a.message}`).join('\n') || 'None'}

Audience drift: ${trajectory.audienceDrift}

Return 1-3 proposals:
[{
  "title": "Short action title",
  "description": "2-3 sentences explaining the proposed change",
  "reasoning": "Why this matters based on the data",
  "dataBacking": "The specific metrics that triggered this",
  "urgency": "high|medium|low"
}]`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const proposals = JSON.parse(text);
    return proposals.map((p: any) => ({ ...p, type: 'strategy' as const }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/brandProposals.ts
git commit -m "feat(brand): add action proposals engine (content + strategy)"
```

---

## Task 6: Weekly Cron Endpoint

**Files:**
- Create: `src/routes/api/cron/brand-intelligence/+server.ts`
- Modify: `vercel.json` (add cron schedule)

The weekly cron orchestrates the full pipeline for all active brands.

- [ ] **Step 1: Create the cron endpoint**

```typescript
// src/routes/api/cron/brand-intelligence/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runBrandIntelligence } from '$lib/server/brandIntelligence';
import { computeTrajectory, generateWeeklyBrief } from '$lib/server/brandTrajectory';
import { fetchCompetitorData, analyseCompetitor, buildCompetitiveMatrix } from '$lib/server/brandCompetitors';
import { generateContentProposals, generateStrategyProposals } from '$lib/server/brandProposals';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Get all active brand accounts
  const brandsRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?select=ig_user_id,ig_username,ig_name,ig_access_token,ig_followers_count`,
    { headers },
  );
  const brands = brandsRes.ok ? await brandsRes.json() : [];
  const results: Array<{ brand: string; status: string; error?: string }> = [];

  for (const brand of brands) {
    try {
      console.log(`[Cron] Processing @${brand.ig_username}`);

      // 1. Fetch competitors for this brand
      const competitorsRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&select=*`,
        { headers },
      );
      const competitors = competitorsRes.ok ? await competitorsRes.json() : [];

      // 2. Analyse competitors
      let competitorSummary = '';
      const competitorAnalyses = [];
      for (const comp of competitors.slice(0, 5)) {
        if (!comp.competitor_ig_id) continue;
        const data = await fetchCompetitorData(comp.competitor_ig_id, brand.ig_access_token);
        if (data) {
          const analysis = await analyseCompetitor(data, anthropicKey);
          competitorAnalyses.push(analysis);
          // Update stored analysis
          await fetch(
            `${supabaseUrl}/rest/v1/brand_competitors?id=eq.${comp.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ latest_analysis: analysis, last_analysed_at: new Date().toISOString() }),
            },
          );
        }
      }
      if (competitorAnalyses.length > 0) {
        competitorSummary = competitorAnalyses
          .map(c => `@${c.username}: ${c.followers} followers, ${c.engagementRate}% eng, themes=${c.contentThemes.join('/')}`)
          .join('; ');
      }

      // 3. Run full intelligence pipeline
      const intelligence = await runBrandIntelligence(
        brand.ig_user_id,
        brand.ig_access_token,
        anthropicKey,
        competitorSummary,
      );

      // 4. Build competitive matrix
      let competitorData = {};
      if (competitorAnalyses.length > 0) {
        const matrix = await buildCompetitiveMatrix(
          { username: brand.ig_username, followers_count: brand.ig_followers_count, engagement_rate: intelligence.engagementRate },
          competitorAnalyses,
          anthropicKey,
        );
        competitorData = matrix;
      }

      // 5. Store snapshot
      const today = new Date().toISOString().split('T')[0];
      const snapshotPayload = {
        brand_ig_id: brand.ig_user_id,
        snapshot_date: today,
        followers: intelligence.profile.followers_count || 0,
        following: (intelligence.profile as any).follows_count || 0,
        media_count: intelligence.profile.media_count || 0,
        impressions_7d: intelligence.accountInsights.impressions7d,
        reach_7d: intelligence.accountInsights.reach7d,
        profile_views_7d: intelligence.accountInsights.profileViews7d,
        engagement_rate: intelligence.engagementRate,
        avg_likes: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.likes, 0) / intelligence.postInsights.length : 0,
        avg_comments: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.comments, 0) / intelligence.postInsights.length : 0,
        avg_saves: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.saved, 0) / intelligence.postInsights.length : 0,
        avg_shares: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.shares, 0) / intelligence.postInsights.length : 0,
        avg_reach: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.reach, 0) / intelligence.postInsights.length : 0,
        posts_per_week: intelligence.postsPerWeek,
        demographics: intelligence.demographics,
        content_performance: intelligence.contentPerformance,
        competitor_data: competitorData,
        intelligence: {
          identity: intelligence.identity,
          audiencePortrait: intelligence.audiencePortrait,
          strategicPositioning: intelligence.strategicPositioning,
          postingHeatmap: intelligence.postingHeatmap,
          bestHours: intelligence.bestHours,
          bestDays: intelligence.bestDays,
          topHashtags: intelligence.topHashtags,
        },
      };

      // Upsert snapshot (unique on brand_ig_id + snapshot_date)
      await fetch(
        `${supabaseUrl}/rest/v1/brand_snapshots`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(snapshotPayload),
        },
      );

      // 6. Compute trajectory
      const historyRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&order=snapshot_date.desc&limit=5`,
        { headers },
      );
      const history = historyRes.ok ? await historyRes.json() : [];
      const previousSnapshot = history.length > 1 ? history[1] : null;
      const trajectory = computeTrajectory(snapshotPayload, previousSnapshot, history);

      // 7. Generate weekly brief
      const brief = await generateWeeklyBrief(
        trajectory,
        snapshotPayload.intelligence,
        { username: brand.ig_username, name: brand.ig_name, followers_count: brand.ig_followers_count },
        anthropicKey,
      );

      await fetch(
        `${supabaseUrl}/rest/v1/brand_weekly_briefs`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            brand_ig_id: brand.ig_user_id,
            brief_date: today,
            headline: brief.headline,
            sections: brief.sections,
            key_metrics: brief.keyMetrics,
          }),
        },
      );

      // 8. Generate proposals
      const contentProposals = await generateContentProposals(intelligence, anthropicKey);
      const strategyProposals = await generateStrategyProposals(trajectory, intelligence, anthropicKey);
      const allProposals = [...contentProposals, ...strategyProposals];

      for (const proposal of allProposals) {
        await fetch(
          `${supabaseUrl}/rest/v1/brand_action_proposals`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              brand_ig_id: brand.ig_user_id,
              type: proposal.type,
              title: (proposal as any).title || '',
              payload: proposal,
              reasoning: (proposal as any).reasoning || '',
              urgency: (proposal as any).urgency || 'medium',
            }),
          },
        );
      }

      // 9. Expire old proposals (>2 weeks, still pending)
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
      await fetch(
        `${supabaseUrl}/rest/v1/brand_action_proposals?brand_ig_id=eq.${encodeURIComponent(brand.ig_user_id)}&status=eq.pending&created_at=lt.${twoWeeksAgo}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'expired' }),
        },
      );

      // 10. Update brand_identity on brand_accounts
      await fetch(
        `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(brand.ig_user_id)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            brand_identity: intelligence.identity,
            identity_updated_at: new Date().toISOString(),
            ig_followers_count: intelligence.profile.followers_count || brand.ig_followers_count,
          }),
        },
      );

      results.push({ brand: brand.ig_username, status: 'ok' });
    } catch (e) {
      console.error(`[Cron] Failed for @${brand.ig_username}:`, e);
      results.push({ brand: brand.ig_username, status: 'error', error: e instanceof Error ? e.message : 'Unknown' });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
```

- [ ] **Step 2: Add cron schedule to vercel.json**

Check if `vercel.json` exists:
```bash
cat /Users/madhviknemani/wagwan-ai/vercel.json 2>/dev/null || echo "NOT_FOUND"
```

If it exists, add the crons field. If not, create it:
```json
{
  "crons": [
    {
      "path": "/api/cron/brand-intelligence",
      "schedule": "0 6 * * 1"
    }
  ]
}
```

This runs every Monday at 6am UTC.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/cron/brand-intelligence/+server.ts vercel.json
git commit -m "feat(brand): add weekly intelligence cron with full pipeline"
```

---

## Task 7: API Endpoints

**Files:**
- Create: `src/routes/api/brand/intelligence/+server.ts`
- Create: `src/routes/api/brand/intelligence/refresh/+server.ts`
- Create: `src/routes/api/brand/intelligence/trajectory/+server.ts`
- Create: `src/routes/api/brand/intelligence/audience/+server.ts`
- Create: `src/routes/api/brand/intelligence/content-matrix/+server.ts`
- Create: `src/routes/api/brand/intelligence/competitors/+server.ts`
- Create: `src/routes/api/brand/intelligence/brief/+server.ts`
- Create: `src/routes/api/brand/intelligence/proposals/+server.ts`
- Create: `src/routes/api/brand/intelligence/proposals/[id]/+server.ts`

These endpoints serve stored intelligence data from Supabase. They do NOT compute on the fly (except `/refresh`).

- [ ] **Step 1: Create GET /intelligence (latest snapshot)**

```typescript
// src/routes/api/brand/intelligence/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=snapshot_date.desc&limit=1`,
    { headers },
  );
  const rows = res.ok ? await res.json() : [];

  if (!rows.length) {
    return json({ ok: true, snapshot: null, message: 'No intelligence data yet. Run a manual refresh or wait for the weekly analysis.' });
  }

  return json({ ok: true, snapshot: rows[0] });
};
```

- [ ] **Step 2: Create POST /intelligence/refresh (manual trigger)**

```typescript
// src/routes/api/brand/intelligence/refresh/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { runBrandIntelligence } from '$lib/server/brandIntelligence';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = env.ANTHROPIC_API_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Get brand token
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token,ig_username,ig_name,ig_followers_count&limit=1`,
    { headers },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brand = brands[0];

  const intelligence = await runBrandIntelligence(igUserId, brand.ig_access_token, anthropicKey);

  // Store snapshot
  const today = new Date().toISOString().split('T')[0];
  await fetch(`${supabaseUrl}/rest/v1/brand_snapshots`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      snapshot_date: today,
      followers: intelligence.profile.followers_count || 0,
      following: 0,
      media_count: intelligence.profile.media_count || 0,
      impressions_7d: intelligence.accountInsights.impressions7d,
      reach_7d: intelligence.accountInsights.reach7d,
      profile_views_7d: intelligence.accountInsights.profileViews7d,
      engagement_rate: intelligence.engagementRate,
      avg_likes: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.likes, 0) / intelligence.postInsights.length : 0,
      avg_comments: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.comments, 0) / intelligence.postInsights.length : 0,
      avg_saves: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.saved, 0) / intelligence.postInsights.length : 0,
      avg_shares: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.shares, 0) / intelligence.postInsights.length : 0,
      avg_reach: intelligence.postInsights.length ? intelligence.postInsights.reduce((s, p) => s + p.reach, 0) / intelligence.postInsights.length : 0,
      posts_per_week: intelligence.postsPerWeek,
      demographics: intelligence.demographics,
      content_performance: intelligence.contentPerformance,
      intelligence: {
        identity: intelligence.identity,
        audiencePortrait: intelligence.audiencePortrait,
        strategicPositioning: intelligence.strategicPositioning,
        postingHeatmap: intelligence.postingHeatmap,
        bestHours: intelligence.bestHours,
        bestDays: intelligence.bestDays,
        topHashtags: intelligence.topHashtags,
      },
    }),
  });

  return json({ ok: true, intelligence });
};
```

- [ ] **Step 3: Create GET /trajectory**

```typescript
// src/routes/api/brand/intelligence/trajectory/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { computeTrajectory } from '$lib/server/brandTrajectory';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=snapshot_date.desc&limit=12`,
    { headers },
  );
  const snapshots = res.ok ? await res.json() : [];

  if (snapshots.length < 2) {
    return json({ ok: true, trajectory: null, snapshots, message: 'Need at least 2 weekly snapshots for trajectory analysis.' });
  }

  const trajectory = computeTrajectory(snapshots[0], snapshots[1], snapshots);
  return json({ ok: true, trajectory, snapshots });
};
```

- [ ] **Step 4: Create GET /audience**

```typescript
// src/routes/api/brand/intelligence/audience/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=demographics,intelligence&order=snapshot_date.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const rows = res.ok ? await res.json() : [];
  if (!rows.length) return json({ ok: true, demographics: null, audiencePortrait: null });

  return json({
    ok: true,
    demographics: rows[0].demographics,
    audiencePortrait: rows[0].intelligence?.audiencePortrait || null,
  });
};
```

- [ ] **Step 5: Create GET /content-matrix**

```typescript
// src/routes/api/brand/intelligence/content-matrix/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=content_performance,intelligence&order=snapshot_date.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const rows = res.ok ? await res.json() : [];
  if (!rows.length) return json({ ok: true, contentPerformance: null });

  return json({ ok: true, contentPerformance: rows[0].content_performance });
};
```

- [ ] **Step 6: Create GET/POST /competitors**

```typescript
// src/routes/api/brand/intelligence/competitors/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  // Get competitors + latest snapshot's competitive matrix
  const [competitorsRes, snapshotRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=competitor_data&order=snapshot_date.desc&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    ),
  ]);

  const competitors = competitorsRes.ok ? await competitorsRes.json() : [];
  const snapshots = snapshotRes.ok ? await snapshotRes.json() : [];

  return json({
    ok: true,
    competitors,
    matrix: snapshots[0]?.competitor_data || null,
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json();
  const username = (body.username || '').trim().replace(/^@/, '');
  if (!username) throw error(400, 'Username required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  await fetch(`${supabaseUrl}/rest/v1/brand_competitors`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      competitor_ig_username: username,
    }),
  });

  return json({ ok: true, added: username });
};
```

- [ ] **Step 7: Create GET /brief**

```typescript
// src/routes/api/brand/intelligence/brief/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_weekly_briefs?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=brief_date.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const rows = res.ok ? await res.json() : [];

  return json({ ok: true, brief: rows[0] || null });
};
```

- [ ] **Step 8: Create GET /proposals**

```typescript
// src/routes/api/brand/intelligence/proposals/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_action_proposals?brand_ig_id=eq.${encodeURIComponent(igUserId)}&status=eq.pending&order=created_at.desc`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const proposals = res.ok ? await res.json() : [];

  return json({ ok: true, proposals });
};
```

- [ ] **Step 9: Create PATCH /proposals/:id (approve/reject)**

```typescript
// src/routes/api/brand/intelligence/proposals/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const PATCH: RequestHandler = async ({ request, params }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json();
  const status = body.status;
  if (!['approved', 'rejected'].includes(status)) {
    throw error(400, 'Status must be "approved" or "rejected"');
  }

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_action_proposals?id=eq.${params.id}&brand_ig_id=eq.${encodeURIComponent(igUserId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, acted_at: new Date().toISOString() }),
    },
  );

  if (!res.ok) throw error(500, 'Failed to update proposal');
  return json({ ok: true, status });
};
```

- [ ] **Step 10: Commit all endpoints**

```bash
git add src/routes/api/brand/intelligence/ src/routes/api/cron/brand-intelligence/
git commit -m "feat(brand): add intelligence API endpoints + cron"
```

---

## Task 8: Verify and Deploy

- [ ] **Step 1: Run type check**

```bash
cd /Users/madhviknemani/wagwan-ai && npm run check 2>&1 | grep -i error | grep -v 'Unused CSS' | grep -v 'css_unused_selector'
```

Expected: only pre-existing errors (brands/login, cron/publish-scheduled).

- [ ] **Step 2: Deploy**

```bash
vercel --prod --force
```

- [ ] **Step 3: Alias**

```bash
vercel alias <deployment-url> wagwanworld.vercel.app
```

- [ ] **Step 4: Verify endpoints respond**

```bash
curl -s https://wagwanworld.vercel.app/api/brand/intelligence | head -c 200
```

Expected: 401 (no auth) — confirms the endpoint exists.

- [ ] **Step 5: Commit migration + vercel.json if not already committed**

```bash
git add -A && git status
git commit -m "feat(brand): brand intelligence agent — complete backend"
```

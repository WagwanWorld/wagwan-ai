# Deep Follower Analytics — Implementation Plan

## Overview

Adds a follower intelligence layer to the Brand OS dashboard. Warehouses daily/weekly follower data from Instagram Graph API (which only retains ~90 days), computes derived growth/momentum/attribution metrics, renders in hand-crafted SVG charts.

---

## Phase 1: Database Migration

**File:** `supabase/migrations/20260511000000_follower_analytics.sql`

### Table 1: `follower_snapshots`

- Daily follower count + reach_28d + media_count
- UNIQUE on `(brand_ig_id, snapshot_date)`
- Index: `(brand_ig_id, snapshot_date DESC)`

### Table 2: `demographic_snapshots`

- Weekly age/gender/city/country breakdowns
- JSONB `data` column for flexible dimension storage
- UNIQUE on `(brand_ig_id, snapshot_week, breakdown_type)`

### Table 3: `online_activity_snapshots`

- Weekly 7x24 heatmap (168 rows per snapshot)
- `day_of_week` (0-6), `hour_of_day` (0-23), `value` (active followers)
- UNIQUE on `(brand_ig_id, snapshot_week, day_of_week, hour_of_day)`

### Table 4: `post_follow_attribution`

- Per-post follower conversion: reach, follows, profile_activity
- `reach_followers` vs `reach_non_followers` breakdown
- UNIQUE on `(brand_ig_id, post_id, captured_at)`

---

## Phase 2: Instagram API Fetchers + Analytics Service

**File:** `src/lib/server/brand/followerAnalytics.ts` (new)

### 2a: IG API Fetchers

1. `fetchFollowerCount(igUserId, token)` — `GET /me?fields=followers_count,media_count` (1 call)
2. `fetchReach28d(igUserId, token)` — `GET /{id}/insights?metric=reach&period=day` for 28 days (1 call)
3. `fetchDemographicBreakdowns(igUserId, token)` — 4 calls (age, gender, city, country)
4. `fetchOnlineFollowers(igUserId, token)` — `GET /{id}/insights?metric=online_followers&period=lifetime` (1 call)
5. `fetchPostFollowAttribution(igUserId, token, postIds)` — Per-post `reach,follows,profile_activity` + `reach` breakdown by follow_type (1+N calls, N capped at 25)

### 2b: Derived Metric Functions (pure, no API calls)

6. `computeGrowthDeltas(snapshots)` — Returns `{ delta24h, delta7d, delta30d, growthRate30d }`
7. `computeMomentum(snapshots)` — `(avg daily growth 7d) / (avg daily growth 28d)` → >1 accelerating, <1 decelerating
8. `computeRecommendedWindows(heatmapRows)` — Top 3 cells, 4h minimum separation
9. `computeFollowerConversionRate(attribution)` — `follows / reach_non_followers` per post
10. `computeChurnProxy(snapshots)` — Estimate unfollows from follower count deltas

---

## Phase 3: Cron Jobs

All follow pattern from `src/routes/api/cron/brand-metric-snapshots/+server.ts`.

| Job                      | File                                                      | Cadence              | API Calls/Brand |
| ------------------------ | --------------------------------------------------------- | -------------------- | --------------- |
| snapshot_followers       | `src/routes/api/cron/snapshot-followers/+server.ts`       | Daily 03:00 UTC      | 2-3             |
| snapshot_demographics    | `src/routes/api/cron/snapshot-demographics/+server.ts`    | Weekly Mon 04:00 UTC | 4               |
| snapshot_online_activity | `src/routes/api/cron/snapshot-online-activity/+server.ts` | Weekly Mon 04:30 UTC | 1               |
| sync_post_insights       | `src/routes/api/cron/sync-post-insights/+server.ts`       | Every 4 hours        | 1+N (N≤25)      |

Register in `vercel.json` crons array.

---

## Phase 4: API Endpoints

All under `src/routes/api/brand/followers/`, using `assertBrandAccess(request)` for auth.

| Endpoint                                                           | Returns                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `GET /followers/summary`                                           | `{ current, delta24h, delta7d, delta30d, growthRate30d }`          |
| `GET /followers/growth?range=30d\|90d`                             | `{ series: [{ date, followers, netNew }] }`                        |
| `GET /followers/demographics?breakdown=age\|gender\|city\|country` | `{ breakdown, data, snapshotWeek }`                                |
| `GET /followers/activity-heatmap`                                  | `{ grid: [{ day, hour, value }], recommendedWindows }`             |
| `GET /followers/sources?range=30d`                                 | `{ posts: [{ postId, caption, reach, follows, conversionRate }] }` |
| `GET /followers/reach-mix?range=30d`                               | `{ followerReach, nonFollowerReach, nonFollowerPct }`              |
| `GET /followers/momentum`                                          | `{ momentum, avg7d, avg28d, trend }`                               |

---

## Phase 5: UI Components (Hand-crafted SVG)

All in `src/lib/components/brands/`, dark theme, no chart libraries.

| Component                        | Type                             | Data                                  |
| -------------------------------- | -------------------------------- | ------------------------------------- |
| `FollowerGrowthChart.svelte`     | SVG line + bar overlay           | Growth time series                    |
| `FollowerDemographics.svelte`    | SVG donuts + horizontal bars     | Age, gender, city, country            |
| `FollowerActivityHeatmap.svelte` | SVG 7x24 grid                    | Online activity + recommended windows |
| `FollowerPostAttribution.svelte` | HTML table + inline SVG bars     | Post-to-follow conversion             |
| `FollowerMomentum.svelte`        | SVG gauge/ring                   | Momentum score                        |
| `FollowerAnalyticsPanel.svelte`  | Container, fetches all endpoints | Arranges sub-components               |

Integration: Add `'followers'` tab to portal page, render `FollowerAnalyticsPanel` when selected.

---

## Implementation Sequence

| Session | Phase | What                           |
| ------- | ----- | ------------------------------ |
| 1       | 1     | DB migration                   |
| 2       | 2a    | IG API fetchers                |
| 3       | 2b    | Derived metric functions       |
| 4       | 3a-3c | Daily + weekly crons           |
| 5       | 3d-3e | Post sync cron + vercel.json   |
| 6       | 4a-4d | First 4 API endpoints          |
| 7       | 4e-4g | Last 3 API endpoints           |
| 8       | 5a-5b | Types + growth chart           |
| 9       | 5c-5d | Demographics + heatmap         |
| 10      | 5e-5g | Attribution + momentum + panel |
| 11      | 5h    | Portal integration             |

## Key Risks

- **Rate limits (200/hr/account):** Capped at ~30 calls/day/brand across all crons
- **90-day data retention:** Must warehouse from day 1; historical data before deployment unavailable
- **Demographics require 100+ followers:** Skip gracefully, show "not enough data" message
- **Reach breakdown availability:** Graceful degradation if follow_type breakdown unavailable

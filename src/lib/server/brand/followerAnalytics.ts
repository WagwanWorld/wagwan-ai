// src/lib/server/brand/followerAnalytics.ts
// Follower analytics: IG Graph API fetchers, derived metrics, and DB persistence.

import { getServiceSupabase } from '$lib/server/supabase';

const IG_API = 'https://graph.instagram.com/v25.0';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FollowerSnapshot {
  followers: number;
  followsCount: number;
  mediaCount: number;
}

export interface DemographicBreakdowns {
  age: Record<string, number>;
  gender: Record<string, number>;
  city: Record<string, number>;
  country: Record<string, number>;
}

export interface OnlineFollowersEntry {
  day: string;
  hours: number[];
}

export interface PostAttribution {
  postId: string;
  reach: number;
  follows: number;
  profileActivity: number;
  reachFollowers: number;
  reachNonFollowers: number;
}

export interface GrowthDeltas {
  current: number;
  delta24h: number;
  delta7d: number;
  delta30d: number;
  growthRate30d: number;
  growthRate7d: number;
}

export interface MomentumResult {
  momentum: number;
  avg7d: number;
  avg28d: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
}

export interface RecommendedWindow {
  day: number;
  hour: number;
  value: number;
  dayName: string;
}

export interface ConversionEntry {
  postId: string;
  reach: number;
  follows: number;
  reachNonFollowers: number;
  conversionRate: number;
}

export interface ChurnProxy {
  estimatedChurn: number;
  churnDays: number;
  totalGrowth: number;
}

// ─── IG API Fetcher Functions ─────────────────────────────────────────────────

/** Fetch basic follower/following/media counts for an account */
export async function fetchFollowerSnapshot(
  igUserId: string,
  token: string,
): Promise<FollowerSnapshot> {
  const url = `${IG_API}/${igUserId}?fields=followers_count,follows_count,media_count&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchFollowerSnapshot failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    followers: data.followers_count ?? 0,
    followsCount: data.follows_count ?? 0,
    mediaCount: data.media_count ?? 0,
  };
}

/** Fetch total reach over a given number of days */
export async function fetchAccountReach(
  igUserId: string,
  token: string,
  days: number,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;
  const url = `${IG_API}/${igUserId}/insights?metric=reach&period=day&since=${since}&until=${now}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchAccountReach failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const values: Array<{ value: number }> = json.data?.[0]?.values ?? [];
  return values.reduce((sum, v) => sum + (v.value ?? 0), 0);
}

/** Fetch follower demographics across age, gender, city, and country */
export async function fetchDemographicBreakdowns(
  igUserId: string,
  token: string,
): Promise<DemographicBreakdowns> {
  const breakdowns: Array<keyof DemographicBreakdowns> = ['age', 'gender', 'city', 'country'];
  const result: DemographicBreakdowns = { age: {}, gender: {}, city: {}, country: {} };

  for (const breakdown of breakdowns) {
    const url = `${IG_API}/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`fetchDemographicBreakdowns(${breakdown}) failed: ${res.status}`);
      continue;
    }
    const json = await res.json();
    const buckets: Array<{ dimension_values: string[]; value: number }> =
      json.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const b of buckets) {
      const key = b.dimension_values?.[0] ?? 'unknown';
      result[breakdown][key] = b.value ?? 0;
    }
  }

  return result;
}

/** Fetch online followers heatmap (7 days x 24 hours) */
export async function fetchOnlineFollowers(
  igUserId: string,
  token: string,
): Promise<OnlineFollowersEntry[]> {
  const url = `${IG_API}/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchOnlineFollowers failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const values: Array<{ end_time: string; value: Record<string, number> }> =
    json.data?.[0]?.values ?? [];

  return values.map((v) => ({
    day: v.end_time,
    hours: Array.from({ length: 24 }, (_, h) => v.value?.[String(h)] ?? 0),
  }));
}

/** Fetch post-level follow attribution metrics (capped at 25 posts) */
export async function fetchPostFollowAttribution(
  igUserId: string,
  token: string,
  postIds: string[],
): Promise<PostAttribution[]> {
  const capped = postIds.slice(0, 25);
  const results: PostAttribution[] = [];

  for (const postId of capped) {
    try {
      // Primary metrics
      const metricsUrl = `${IG_API}/${postId}/insights?metric=reach,follows,profile_activity&access_token=${token}`;
      const metricsRes = await fetch(metricsUrl);
      let reach = 0,
        follows = 0,
        profileActivity = 0;
      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json();
        const metricsData: Array<{ name: string; values: Array<{ value: number }> }> =
          metricsJson.data ?? [];
        for (const m of metricsData) {
          const val = m.values?.[0]?.value ?? 0;
          if (m.name === 'reach') reach = val;
          else if (m.name === 'follows') follows = val;
          else if (m.name === 'profile_activity') profileActivity = val;
        }
      }

      // Follower vs non-follower reach breakdown
      let reachFollowers = 0,
        reachNonFollowers = 0;
      const breakdownUrl = `${IG_API}/${postId}/insights?metric=reach&breakdown=follow_type&access_token=${token}`;
      const breakdownRes = await fetch(breakdownUrl);
      if (breakdownRes.ok) {
        const breakdownJson = await breakdownRes.json();
        const buckets: Array<{ dimension_values: string[]; value: number }> =
          breakdownJson.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        for (const b of buckets) {
          const dim = b.dimension_values?.[0]?.toLowerCase() ?? '';
          if (dim === 'follower' || dim === 'followed_by') reachFollowers = b.value ?? 0;
          else if (dim === 'non_follower' || dim === 'not_followed_by')
            reachNonFollowers = b.value ?? 0;
        }
      }

      results.push({ postId, reach, follows, profileActivity, reachFollowers, reachNonFollowers });
    } catch (err) {
      console.warn(`fetchPostFollowAttribution(${postId}) error:`, err);
    }
  }

  return results;
}

// ─── Derived Metric Functions (pure, no API/DB calls) ─────────────────────────

type SnapshotRow = { snapshot_date: string; followers: number };

/** Compute growth deltas from date-descending sorted snapshots */
export function computeGrowthDeltas(snapshots: SnapshotRow[]): GrowthDeltas {
  if (snapshots.length === 0) {
    return { current: 0, delta24h: 0, delta7d: 0, delta30d: 0, growthRate30d: 0, growthRate7d: 0 };
  }

  const current = snapshots[0].followers;
  const now = new Date(snapshots[0].snapshot_date).getTime();

  const findClosest = (daysAgo: number): number => {
    const target = now - daysAgo * 86400_000;
    let best = snapshots[snapshots.length - 1];
    for (const s of snapshots) {
      if (
        Math.abs(new Date(s.snapshot_date).getTime() - target) <
        Math.abs(new Date(best.snapshot_date).getTime() - target)
      ) {
        best = s;
      }
    }
    return best.followers;
  };

  const f1d = findClosest(1);
  const f7d = findClosest(7);
  const f30d = findClosest(30);

  const delta24h = current - f1d;
  const delta7d = current - f7d;
  const delta30d = current - f30d;
  const growthRate30d = f30d > 0 ? ((current - f30d) / f30d) * 100 : 0;
  const growthRate7d = f7d > 0 ? ((current - f7d) / f7d) * 100 : 0;

  return { current, delta24h, delta7d, delta30d, growthRate30d, growthRate7d };
}

/** Compute momentum: compare recent 7d average daily growth to 28d average */
export function computeMomentum(snapshots: SnapshotRow[]): MomentumResult {
  if (snapshots.length < 2) {
    return { momentum: 1, avg7d: 0, avg28d: 0, trend: 'steady' };
  }

  const now = new Date(snapshots[0].snapshot_date).getTime();

  const netInWindow = (days: number): number => {
    const cutoff = now - days * 86400_000;
    const inWindow = snapshots.filter((s) => new Date(s.snapshot_date).getTime() >= cutoff);
    if (inWindow.length < 2) return 0;
    return inWindow[0].followers - inWindow[inWindow.length - 1].followers;
  };

  const net7 = netInWindow(7);
  const net28 = netInWindow(28);
  const avg7d = net7 / 7;
  const avg28d = net28 / 28;
  const momentum = avg28d !== 0 ? avg7d / avg28d : 1;

  let trend: MomentumResult['trend'] = 'steady';
  if (momentum > 1.15) trend = 'accelerating';
  else if (momentum < 0.85) trend = 'decelerating';

  return { momentum, avg7d, avg28d, trend };
}

/** Pick top 3 posting windows from online-followers grid with minimum 4h separation */
export function computeRecommendedWindows(
  grid: Array<{ day: number; hour: number; value: number }>,
): RecommendedWindow[] {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const sorted = [...grid].sort((a, b) => b.value - a.value);
  const picked: RecommendedWindow[] = [];

  for (const cell of sorted) {
    if (picked.length >= 3) break;
    const tooClose = picked.some((p) => {
      const sameDayOrAdjacent = Math.abs(p.day - cell.day) <= 1 || Math.abs(p.day - cell.day) >= 6;
      const hourClose = Math.abs(p.hour - cell.hour) < 4;
      return sameDayOrAdjacent && hourClose;
    });
    if (!tooClose) {
      picked.push({
        day: cell.day,
        hour: cell.hour,
        value: cell.value,
        dayName: DAY_NAMES[cell.day % 7],
      });
    }
  }

  return picked;
}

/** Compute follower conversion rate per post from attribution data */
export function computeFollowerConversionRate(
  attributions: Array<{
    postId: string;
    reach: number;
    follows: number;
    reachNonFollowers: number;
  }>,
): ConversionEntry[] {
  return attributions
    .map((a) => ({
      ...a,
      conversionRate: a.reachNonFollowers > 0 ? a.follows / a.reachNonFollowers : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);
}

/** Estimate churn from days where follower count decreased */
export function computeChurnProxy(snapshots: SnapshotRow[]): ChurnProxy {
  let estimatedChurn = 0;
  let churnDays = 0;
  let totalGrowth = 0;

  for (let i = 0; i < snapshots.length - 1; i++) {
    const diff = snapshots[i].followers - snapshots[i + 1].followers;
    totalGrowth += diff;
    if (diff < 0) {
      estimatedChurn += Math.abs(diff);
      churnDays++;
    }
  }

  return { estimatedChurn, churnDays, totalGrowth };
}

// ─── DB Write Functions ───────────────────────────────────────────────────────

/** UPSERT a daily follower snapshot */
export async function saveFollowerSnapshot(
  brandIgId: string,
  data: FollowerSnapshot & { reach28d?: number },
): Promise<void> {
  const supabase = getServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('follower_snapshots').upsert(
    {
      brand_ig_id: brandIgId,
      snapshot_date: today,
      followers: data.followers,
      follows_count: data.followsCount,
      media_count: data.mediaCount,
      reach_28d: data.reach28d ?? 0,
    },
    { onConflict: 'brand_ig_id,snapshot_date' },
  );
  if (error) throw new Error(`saveFollowerSnapshot failed: ${error.message}`);
}

/** UPSERT demographic breakdown rows (one per breakdown type) */
export async function saveDemographicSnapshot(
  brandIgId: string,
  weekDate: string,
  breakdowns: DemographicBreakdowns,
): Promise<void> {
  const supabase = getServiceSupabase();
  const rows = (['age', 'gender', 'city', 'country'] as const).map((type) => ({
    brand_ig_id: brandIgId,
    snapshot_week: weekDate,
    breakdown_type: type,
    data: breakdowns[type],
  }));

  const { error } = await supabase
    .from('demographic_snapshots')
    .upsert(rows, { onConflict: 'brand_ig_id,snapshot_week,breakdown_type' });
  if (error) throw new Error(`saveDemographicSnapshot failed: ${error.message}`);
}

/** UPSERT online activity grid (168 rows = 7 days x 24 hours) */
export async function saveOnlineActivitySnapshot(
  brandIgId: string,
  weekDate: string,
  grid: Array<{ day: number; hour: number; value: number }>,
): Promise<void> {
  const supabase = getServiceSupabase();
  const rows = grid.map((cell) => ({
    brand_ig_id: brandIgId,
    snapshot_week: weekDate,
    day_of_week: cell.day,
    hour_of_day: cell.hour,
    value: cell.value,
  }));

  const { error } = await supabase
    .from('online_activity_snapshots')
    .upsert(rows, { onConflict: 'brand_ig_id,snapshot_week,day_of_week,hour_of_day' });
  if (error) throw new Error(`saveOnlineActivitySnapshot failed: ${error.message}`);
}

/** UPSERT post follow attribution metrics */
export async function savePostAttribution(
  brandIgId: string,
  attributions: PostAttribution[],
): Promise<void> {
  const supabase = getServiceSupabase();
  const rows = attributions.map((a) => ({
    brand_ig_id: brandIgId,
    post_id: a.postId,
    reach: a.reach,
    follows: a.follows,
    profile_activity: a.profileActivity,
    reach_followers: a.reachFollowers,
    reach_non_followers: a.reachNonFollowers,
    last_synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('post_follow_attribution')
    .upsert(rows, { onConflict: 'brand_ig_id,post_id' });
  if (error) throw new Error(`savePostAttribution failed: ${error.message}`);
}

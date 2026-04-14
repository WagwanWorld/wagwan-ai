/**
 * Creator scoring engine — builds portraits from DB, scores against brand brief.
 * Deterministic code, no LLM calls.
 */

import { getServiceSupabase } from '../supabase';
import { computeGraphStrength } from './graphStrength';
import { flattenIdentityGraph } from './identityGraphTags';
import type { BrandBrief, CreatorPortrait, MatchResult, MatchOutput } from './brandMatchAgent';

// ── Budget Tier Follower Ranges ──

const TIER_RANGES: Record<string, [number, number]> = {
  nano: [500, 5_000],
  micro: [5_000, 25_000],
  mid: [25_000, 100_000],
  macro: [100_000, Infinity],
};

// ── Build Portraits from DB ──

export async function loadCreatorPortraits(): Promise<CreatorPortrait[]> {
  const sb = getServiceSupabase();

  const [profileRes, ratesRes, interactionsRes] = await Promise.all([
    sb.from('user_profiles').select('google_sub, name, profile_data, identity_graph').limit(1000),
    sb.from('creator_rates').select('*').eq('available', true),
    sb.from('campaign_interactions').select('user_google_sub, campaign_id'),
  ]);

  const profiles = profileRes.data ?? [];
  const ratesMap = new Map<string, any>();
  for (const r of ratesRes.data ?? []) {
    ratesMap.set(r.user_google_sub, {
      ig_post_rate_inr: r.ig_post_rate_inr,
      ig_story_rate_inr: r.ig_story_rate_inr,
      ig_reel_rate_inr: r.ig_reel_rate_inr,
      available: r.available,
    });
  }

  // Count past brand categories per user
  const pastCategories = new Map<string, string[]>();
  for (const i of interactionsRes.data ?? []) {
    const sub = i.user_google_sub as string;
    if (!pastCategories.has(sub)) pastCategories.set(sub, []);
  }

  return profiles.map((row): CreatorPortrait => {
    const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
    const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
    const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
    const inference = graph.inferenceIdentity as any;
    const snapshot = graph.identitySnapshot as any;
    const derived = inference?.current?.derived_signals;

    const strength = computeGraphStrength(graph, profileData);

    return {
      google_sub: row.google_sub as string,
      name: (row.name as string) || '',
      handle: (ig?.username as string) || '',
      follower_count: (ig?.followersCount as number) || 0,
      builder_score: derived?.builder_score ?? 0,
      creator_score: derived?.creator_score ?? 0,
      momentum_score: derived?.momentum_score ?? 0,
      content_themes: flattenIdentityGraph(graph).slice(0, 15),
      engagement_tier: (graph.engagementTier as string) || '',
      posting_cadence: (graph.igPostingCadence as string) || '',
      location: (graph.city as string) || (profileData.city as string) || '',
      archetype: snapshot?.payload?.archetype || '',
      ig_creator_tier: (graph.igCreatorTier as string) || '',
      rates: ratesMap.get(row.google_sub as string) || null,
      graph_strength: strength.score,
      past_brand_categories: pastCategories.get(row.google_sub as string) || [],
    };
  });
}

// ── Scoring ──

function credibilityScore(creator: CreatorPortrait, brief: BrandBrief): number {
  const needed = new Set(brief.content_themes_needed.map(t => t.toLowerCase()));
  const has = new Set(creator.content_themes.map(t => t.toLowerCase()));
  if (!needed.size) return 0.5;

  let overlap = 0;
  for (const n of needed) {
    for (const h of has) {
      if (h.includes(n) || n.includes(h)) { overlap++; break; }
    }
  }
  return Math.min(1, overlap / needed.size);
}

function audienceScore(creator: CreatorPortrait, brief: BrandBrief): number {
  // Infer audience composition from creator's content themes + archetype
  const signals = [
    ...creator.content_themes,
    creator.archetype,
    creator.engagement_tier,
    creator.location,
  ].map(s => s.toLowerCase());

  const buyerSignals = brief.buyer_identity_signals.map(s => s.toLowerCase());
  if (!buyerSignals.length) return 0.5;

  let match = 0;
  for (const b of buyerSignals) {
    for (const s of signals) {
      if (s.includes(b) || b.includes(s)) { match++; break; }
    }
  }

  let geo = 0;
  if (brief.geography.length) {
    const geoLower = brief.geography.map(g => g.toLowerCase());
    if (geoLower.some(g => creator.location.toLowerCase().includes(g))) geo = 0.2;
  }

  return Math.min(1, (match / Math.max(1, buyerSignals.length)) + geo);
}

function engagementScore(creator: CreatorPortrait): number {
  let score = 0.4;
  const tier = creator.engagement_tier.toLowerCase();
  if (tier.includes('high') || tier.includes('rising')) score += 0.25;
  if (creator.graph_strength > 65) score += 0.15;
  if (creator.posting_cadence.includes('daily') || creator.posting_cadence.includes('3-4')) score += 0.1;
  return Math.min(1, score);
}

function momentumNorm(creator: CreatorPortrait): number {
  return Math.min(1, creator.momentum_score / 100);
}

// ── Disqualification ──

function isDisqualified(creator: CreatorPortrait, brief: BrandBrief): string | null {
  // Posting cadence too low
  const cadence = creator.posting_cadence.toLowerCase();
  if (cadence.includes('inactive') || cadence.includes('rarely')) return 'inactive posting';

  // Graph strength too low
  if (creator.graph_strength < 30) return 'insufficient portrait data';

  // Follower count outside tier
  const range = TIER_RANGES[brief.budget_tier];
  if (range) {
    if (creator.follower_count < range[0] || creator.follower_count > range[1]) {
      return `follower count outside ${brief.budget_tier} tier range`;
    }
  }

  // Not available for deals
  if (!creator.rates?.available) return 'not available for deals';

  // Bad fit signals
  const badFit = brief.bad_fit_signals.map(s => s.toLowerCase());
  const creatorSignals = creator.content_themes.map(t => t.toLowerCase()).join(' ');
  for (const bad of badFit) {
    if (creatorSignals.includes(bad)) return `overlaps with bad-fit signal: ${bad}`;
  }

  return null;
}

// ── Main Matching Function ──

export function scoreCreators(
  portraits: CreatorPortrait[],
  brief: BrandBrief,
  limit = 5,
): MatchOutput {
  const qualified: { portrait: CreatorPortrait; score: number }[] = [];
  let disqualifiedCount = 0;
  const disqualReasons: Record<string, number> = {};

  for (const creator of portraits) {
    const dqReason = isDisqualified(creator, brief);
    if (dqReason) {
      disqualifiedCount++;
      disqualReasons[dqReason] = (disqualReasons[dqReason] ?? 0) + 1;
      continue;
    }

    const cred = credibilityScore(creator, brief);
    const aud = audienceScore(creator, brief);
    const eng = engagementScore(creator);
    const mom = momentumNorm(creator);

    const score = Math.round((cred * 0.30 + aud * 0.35 + eng * 0.20 + mom * 0.15) * 100);
    qualified.push({ portrait: creator, score });
  }

  qualified.sort((a, b) => b.score - a.score);
  const topMatches = qualified.slice(0, limit);

  const matches: MatchResult[] = topMatches.map(({ portrait, score }) => ({
    creator: portrait,
    score,
    reasoning: buildReasoning(portrait, brief, score),
    watch_out: buildWatchOut(portrait, brief),
  }));

  const topDqReason = Object.entries(disqualReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various reasons';

  return {
    matches,
    disqualified_count: disqualifiedCount,
    disqualified_reason: topDqReason,
  };
}

function buildReasoning(creator: CreatorPortrait, brief: BrandBrief, score: number): string {
  const themes = creator.content_themes.filter(t =>
    brief.content_themes_needed.some(n => t.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(t.toLowerCase()))
  ).slice(0, 3);
  const themeStr = themes.length ? `Posts credibly about ${themes.join(', ')}.` : '';
  const archStr = creator.archetype ? `${creator.archetype}.` : '';
  const locStr = brief.geography.length && creator.location ? `Based in ${creator.location}.` : '';
  return [archStr, themeStr, locStr, `${creator.follower_count.toLocaleString()} followers.`].filter(Boolean).join(' ');
}

function buildWatchOut(creator: CreatorPortrait, brief: BrandBrief): string {
  if (creator.graph_strength < 50) return 'Portrait data is limited — verify their content directly.';
  if (creator.momentum_score < 30) return 'Growth has slowed recently — check recent engagement.';
  if (creator.posting_cadence.includes('1-2')) return 'Posts infrequently — confirm they can meet timeline.';
  return 'Review their recent posts to confirm brand voice alignment.';
}

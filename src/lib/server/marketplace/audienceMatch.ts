import type { ParsedAudience, AudienceSearchUserRow, AudienceSearchResult } from './types';
import { computeGraphStrength } from './graphStrength';
import { flattenIdentityGraph } from './identityGraphTags';

export { flattenIdentityGraph } from './identityGraphTags';

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function overlapScore(queryTokens: Set<string>, corpus: string[]): number {
  if (!queryTokens.size || !corpus.length) return 0;
  const cset = new Set(corpus);
  let hit = 0;
  for (const q of queryTokens) {
    for (const c of cset) {
      if (c.includes(q) || q.includes(c)) {
        hit++;
        break;
      }
    }
  }
  return Math.min(1, hit / Math.max(4, queryTokens.size));
}

function engagementStub(graph: Record<string, unknown>): number {
  const tier = String(graph.igCreatorTier ?? '').toLowerCase();
  const cadence = String(graph.igPostingCadence ?? '').toLowerCase();
  let base = 0.5;
  if (tier.includes('macro') || tier.includes('mid')) base = 0.65;
  if (tier.includes('nano') || tier.includes('micro')) base = 0.58;
  if (cadence.includes('daily') || cadence.includes('often')) base += 0.08;
  return Math.min(0.95, base);
}

function intentStub(profileData: Record<string, unknown>, queryTokens: Set<string>): number {
  const intents = profileData.intents;
  if (!Array.isArray(intents) || !intents.length) return 0.45;
  const flat = intents.map(x => String(x).toLowerCase());
  return overlapScore(queryTokens, flat) || 0.45;
}

export function queryTagSets(parsed: ParsedAudience): {
  interestSet: Set<string>;
  behaviorSet: Set<string>;
  allQuery: Set<string>;
} {
  const interestSet = new Set(parsed.interests.map(s => s.toLowerCase()));
  const behaviorSet = new Set(parsed.behaviors.map(s => s.toLowerCase()));
  const allQuery = new Set([...interestSet, ...behaviorSet]);
  if (parsed.location?.trim()) {
    allQuery.add(parsed.location.trim().toLowerCase());
  }
  return { interestSet, behaviorSet, allQuery };
}

export interface ProfileRowForMatch {
  google_sub: string;
  name: string | null;
  identity_graph: Record<string, unknown>;
  profile_data: Record<string, unknown>;
  updated_at?: string | null;
}

export function scoreUserAgainstAudience(
  row: ProfileRowForMatch,
  parsed: ParsedAudience,
  extraManualTags: string[] = [],
): Omit<AudienceSearchUserRow, 'name' | 'city' | 'graph_strength' | 'graph_strength_label'> & {
  name: string;
  city: string;
} {
  const graph = row.identity_graph ?? {};
  let userTags = flattenIdentityGraph(graph);
  if (!userTags.length && Array.isArray(row.profile_data?.interests)) {
    userTags = (row.profile_data.interests as unknown[])
      .map(x => String(x).trim().toLowerCase())
      .filter(Boolean);
  }
  if (extraManualTags.length) {
    const merged = new Set(userTags);
    for (const t of extraManualTags) {
      const x = t.trim().toLowerCase();
      if (x.length > 1) merged.add(x);
    }
    userTags = [...merged];
  }
  const userSet = new Set(userTags);
  const { interestSet, behaviorSet, allQuery } = queryTagSets(parsed);

  const interest_match = jaccard(interestSet, userSet) * 0.7 + overlapScore(interestSet, userTags) * 0.3;
  const behavior_match =
    jaccard(behaviorSet, userSet) * 0.5 + overlapScore(behaviorSet, userTags) * 0.5;

  let location_boost = 0;
  if (parsed.location?.trim()) {
    const loc = parsed.location.trim().toLowerCase();
    const city = String(graph.city ?? '').toLowerCase();
    const liLoc = String(graph.linkedinLocation ?? '').toLowerCase();
    if (city.includes(loc) || liLoc.includes(loc) || userTags.some(t => t.includes(loc))) {
      location_boost = 0.15;
    }
  }

  const intent_signal = intentStub(row.profile_data ?? {}, allQuery);
  const engagement_probability = engagementStub(graph);

  const weighted =
    (interest_match + location_boost) * 0.4 +
    behavior_match * 0.3 +
    intent_signal * 0.2 +
    engagement_probability * 0.1;

  const match_score = Math.round(Math.min(100, Math.max(0, weighted * 100)) * 10) / 10;

  const overlapping = userTags.filter(
    t => [...allQuery].some(q => t.includes(q) || q.includes(t)),
  );
  const preview_tags = [...new Set(overlapping)].slice(0, 3);
  const topReason =
    preview_tags.length > 0
      ? preview_tags.slice(0, 2).join(', ')
      : userTags.slice(0, 2).join(', ') || 'general profile fit';

  const match_reason =
    preview_tags.length > 0
      ? `Strong overlap on ${topReason.replace(/,/g, ' &')}`
      : interest_match + behavior_match > 0
        ? `Aligned with your stated interests and activity signals`
        : `Broad lifestyle fit from connected data`;

  const name =
    (typeof graph.name === 'string' && graph.name.trim()) ||
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.profile_data?.name === 'string' && String(row.profile_data.name).trim()) ||
    'Member';

  const city =
    (typeof graph.city === 'string' && graph.city.trim()) ||
    (typeof row.profile_data?.city === 'string' && String(row.profile_data.city).trim()) ||
    '';

  const followers = typeof graph.igFollowerCount === 'number'
    ? graph.igFollowerCount
    : typeof graph.followerCount === 'number'
      ? graph.followerCount
      : typeof graph.igFollowers === 'number'
        ? graph.igFollowers
        : 0;

  return {
    user_google_sub: row.google_sub,
    name,
    city,
    followers,
    match_score,
    match_score_breakdown: {
      interest_match: Math.round(interest_match * 100) / 100,
      behavior_match: Math.round(behavior_match * 100) / 100,
      intent_signal: Math.round(intent_signal * 100) / 100,
      engagement_probability: Math.round(engagement_probability * 100) / 100,
    },
    match_reason,
    preview_tags,
  };
}

export function rankAudience(
  rows: ProfileRowForMatch[],
  parsed: ParsedAudience,
  opts: {
    limit: number;
    minScore?: number;
    reward_inr?: number | null;
    manualTagsBySub?: Map<string, string[]>;
    rankStrengthBoost?: boolean;
  },
): AudienceSearchResult {
  const minScore = opts.minScore ?? 5;
  const manualMap = opts.manualTagsBySub ?? new Map<string, string[]>();
  const boost = Boolean(opts.rankStrengthBoost);

  const scored: AudienceSearchUserRow[] = rows.map(r => {
    const manual = manualMap.get(r.google_sub) ?? [];
    const base = scoreUserAgainstAudience(r, parsed, manual);
    const gs = computeGraphStrength(r.identity_graph, r.profile_data ?? {}, r.updated_at);
    return {
      ...base,
      graph_strength: gs.score,
      graph_strength_label: gs.label,
    };
  });

  const sortKey = (u: AudienceSearchUserRow) =>
    u.match_score + (boost ? u.graph_strength * 0.05 : 0);

  const filtered = scored.filter(u => u.match_score >= minScore);
  filtered.sort((a, b) => sortKey(b) - sortKey(a));
  const slice = filtered.slice(0, opts.limit);

  const tagCounts = new Map<string, number>();
  for (const u of slice) {
    for (const t of u.preview_tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const key_traits = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  const avgEng: number =
    slice.length === 0
      ? 0
      : slice.reduce(
          (s, u) => s + Number(u.match_score_breakdown?.engagement_probability ?? 0.5),
          0,
        ) / slice.length;
  const estimated_engagement =
    slice.length === 0 ? 'unknown' : avgEng > 0.62 ? 'high' : avgEng > 0.48 ? 'medium' : 'moderate';

  const reward = opts.reward_inr;
  const estimated_cost_inr =
    reward != null && Number.isFinite(reward) ? Math.round(reward * slice.length * 100) / 100 : null;

  const avg_graph_strength =
    slice.length === 0
      ? 0
      : Math.round((slice.reduce((s, u) => s + u.graph_strength, 0) / slice.length) * 10) / 10;
  const highN = slice.filter(u => u.graph_strength >= 65).length;
  const pct_high_strength_graphs =
    slice.length === 0 ? 0 : Math.round((highN / slice.length) * 1000) / 10;

  return {
    audience_size: slice.length,
    users: slice,
    key_traits,
    estimated_engagement,
    estimated_cost_inr,
    avg_graph_strength,
    pct_high_strength_graphs,
    rank_strength_boost_applied: boost,
  };
}

/**
 * Correlates brand-search quality with richness of identity_graph + profile signals.
 */
import type { GraphStrengthLabel } from './types';
import { flattenIdentityGraph } from './identityGraphTags';

export type FreshnessBucket = 'fresh' | 'ok' | 'stale';

export interface GraphStrengthDetail {
  score: number;
  label: GraphStrengthLabel;
  coverage_score: number;
  source_count: number;
  tag_count: number;
  freshness_bucket: FreshnessBucket;
}

const COVERAGE_KEYS: string[] = [
  'interests',
  'topGenres',
  'activities',
  'brandVibes',
  'skills',
  'contentCategories',
  'lifestyleSignals',
  'topChannels',
  'headline',
  'linkedinCareerSnippet',
  'googleSignalTags',
  'musicDescriptorTags',
  'manualTags',
  'igInsightsTags',
  'professionalThemeTags',
  'musicSignalNarrative',
];

function nonEmpty(graph: Record<string, unknown>, key: string): boolean {
  const v = graph[key];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 2;
  return false;
}

function sourceBreadth(graph: Record<string, unknown>, profileData: Record<string, unknown>): number {
  let n = 0;
  const meta = graph.signalMeta as Record<string, unknown> | undefined;
  if (meta?.hasInstagram === true) n++;
  if (meta?.hasStreamingIdentity === true) n++;
  if (meta?.hasLinkedIn === true) n++;
  if (meta?.hasYoutube === true) n++;

  if (!meta || n === 0) {
    if (profileData?.instagramConnected === true || profileData?.instagramIdentity) n++;
    if (profileData?.spotifyConnected === true || profileData?.appleMusicConnected === true) n++;
    if (profileData?.linkedinConnected === true) n++;
    if (profileData?.youtubeConnected === true || profileData?.googleConnected === true) n++;
    n = Math.min(4, n);
  }

  return Math.min(4, n);
}

function freshnessScore(iso: string | null | undefined): { bucket: FreshnessBucket; points: number } {
  if (!iso?.trim()) return { bucket: 'ok', points: 55 };
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return { bucket: 'ok', points: 55 };
  const days = (Date.now() - ms) / (86400 * 1000);
  if (days <= 7) return { bucket: 'fresh', points: 100 };
  if (days <= 30) return { bucket: 'ok', points: 70 };
  if (days <= 90) return { bucket: 'stale', points: 40 };
  return { bucket: 'stale', points: 25 };
}

function labelFromScore(score: number): GraphStrengthLabel {
  if (score >= 65) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

/**
 * @param updatedAt - user_profiles.updated_at ISO string
 */
export function computeGraphStrength(
  identityGraph: Record<string, unknown>,
  profileData: Record<string, unknown>,
  updatedAt?: string | null,
): GraphStrengthDetail {
  const graph = identityGraph ?? {};
  const tags = flattenIdentityGraph(graph);
  const tag_count = tags.length;

  let filled = 0;
  for (const k of COVERAGE_KEYS) {
    if (nonEmpty(graph, k)) filled++;
  }
  if (tag_count >= 25) filled += 2;
  else if (tag_count >= 12) filled += 1;

  const coverage_ratio = Math.min(1, filled / (COVERAGE_KEYS.length + 2));
  const coverage_score = Math.round(coverage_ratio * 100);

  const source_count = sourceBreadth(graph, profileData ?? {});
  const source_score = (source_count / 4) * 100;

  const { bucket: freshness_bucket, points: freshness_points } = freshnessScore(updatedAt ?? null);

  const raw =
    coverage_score * 0.42 + source_score * 0.38 + freshness_points * 0.2 + Math.min(15, tag_count / 3);

  const score = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;

  return {
    score,
    label: labelFromScore(score),
    coverage_score,
    source_count,
    tag_count,
    freshness_bucket,
  };
}

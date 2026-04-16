import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { getServiceSupabase } from '$lib/server/supabase';
import type { MatchResult, CohortResult, WeightedSignal } from './types';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const VECTOR_DIMENSIONS = [
  'music_genre', 'music_artist', 'aesthetic', 'lifestyle', 'brand_affinity',
  'career_stage', 'creator_tier', 'engagement', 'budget', 'city_tier',
  'purchase_intent', 'travel_affinity', 'fitness_wellness', 'tech_media',
  'social_creator', 'content_consumption', 'temporal_morning', 'temporal_evening',
] as const;

// Map signal category to vector dimension index
export function mapSignalToDimension(category: string, _value: string): number {
  const cat = category.toLowerCase();
  if (cat.includes('music genre')) return 0;
  if (cat.includes('music artist') || cat.includes('music genre cluster')) return 1;
  if (cat.includes('aesthetic') || cat.includes('instagram descriptor')) return 2;
  if (cat.includes('lifestyle')) return 3;
  if (cat.includes('brand')) return 4;
  if (cat.includes('career') || cat.includes('professional')) return 5;
  if (cat.includes('creator')) return 6;
  if (cat.includes('engagement')) return 7;
  if (cat.includes('budget')) return 8;
  if (cat.includes('city')) return 9;
  if (cat.includes('purchase') || cat.includes('intent')) return 10;
  if (cat.includes('travel')) return 11;
  if (cat.includes('fitness') || cat.includes('wellness') || cat.includes('health')) return 12;
  if (cat.includes('tech') || cat.includes('media')) return 13;
  if (cat.includes('social') || cat.includes('creator tier')) return 14;
  if (cat.includes('content') || cat.includes('consumption')) return 15;
  return -1;
}

export function mapDomainToDimension(domainId: string): number {
  const id = domainId.toLowerCase();
  if (id.includes('music')) return 0;
  if (id.includes('aesthetic') || id.includes('fashion')) return 2;
  if (id.includes('lifestyle')) return 3;
  if (id.includes('career') || id.includes('work') || id.includes('professional')) return 5;
  if (id.includes('creator')) return 6;
  if (id.includes('travel')) return 11;
  if (id.includes('fitness') || id.includes('health') || id.includes('wellness')) return 12;
  if (id.includes('tech')) return 13;
  if (id.includes('social')) return 14;
  return -1;
}

export async function buildUserSignalVectors(
  userIds: string[]
): Promise<Map<string, number[]>> {
  const vectors = new Map<string, number[]>();
  if (userIds.length === 0) return vectors;

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('identity_graphs')
    .select('google_sub, signal_meter, inference_identity')
    .in('google_sub', userIds);

  for (const user of data ?? []) {
    const vec = new Array(VECTOR_DIMENSIONS.length).fill(0);
    const signals: Array<{category: string, value: string, final_score: number}> =
      (user.signal_meter as any)?.signals ?? [];
    const domains: Array<{id: string, salience_0_100: number}> =
      (user.inference_identity as any)?.current?.life_domains ?? [];

    for (const sig of signals) {
      const dim = mapSignalToDimension(sig.category, sig.value);
      if (dim >= 0) vec[dim] = Math.max(vec[dim], sig.final_score ?? 0);
    }
    for (const domain of domains) {
      const dim = mapDomainToDimension(domain.id);
      if (dim >= 0) vec[dim] = Math.max(vec[dim], (domain.salience_0_100 ?? 0) / 100);
    }
    vectors.set(user.google_sub, vec);
  }

  return vectors;
}

export function buildVectorFromSignalMeter(signalMeter: unknown): number[] {
  const vec = new Array(VECTOR_DIMENSIONS.length).fill(0);
  const signals: Array<{category: string, value: string, final_score: number}> =
    (signalMeter as any)?.signals ?? [];
  for (const sig of signals) {
    const dim = mapSignalToDimension(sig.category, sig.value);
    if (dim >= 0) vec[dim] = Math.max(vec[dim], sig.final_score ?? 0);
  }
  return vec;
}

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + Math.pow(ai - (b[i] ?? 0), 2), 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function kMeansPlusPlusSeed(vecs: number[][], k: number): number[][] {
  if (vecs.length === 0) return [];
  const centroids: number[][] = [vecs[Math.floor(Math.random() * vecs.length)]];

  while (centroids.length < k) {
    const distances = vecs.map(v =>
      Math.min(...centroids.map(c => euclideanDistance(v, c)))
    );
    const totalDist = distances.reduce((s, d) => s + d * d, 0);
    let r = Math.random() * totalDist;
    let chosen = vecs[vecs.length - 1];
    for (let i = 0; i < vecs.length; i++) {
      r -= distances[i] * distances[i];
      if (r <= 0) { chosen = vecs[i]; break; }
    }
    centroids.push(chosen);
  }
  return centroids;
}

export function kMeansClusters(
  vectors: Map<string, number[]>,
  k: number
): Map<string, string> {
  const users = [...vectors.keys()];
  const vecs = users.map(u => vectors.get(u)!);

  if (vecs.length === 0 || k <= 0) return new Map();

  const safeK = Math.min(k, vecs.length);
  const dim = vecs[0].length;
  let centroids = kMeansPlusPlusSeed(vecs, safeK);
  let assignments = new Array(users.length).fill(0);

  for (let iter = 0; iter < 50; iter++) {
    const newAssignments = vecs.map(v =>
      centroids.reduce(
        (best, c, i) => {
          const dist = euclideanDistance(v, c);
          return dist < best.dist ? { dist, idx: i } : best;
        },
        { dist: Infinity, idx: 0 }
      ).idx
    );

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    centroids = Array.from({ length: safeK }, (_, ci) => {
      const clusterVecs = vecs.filter((_, i) => assignments[i] === ci);
      if (clusterVecs.length === 0) return centroids[ci];
      return Array.from({ length: dim }, (_, d) =>
        clusterVecs.reduce((sum, v) => sum + v[d], 0) / clusterVecs.length
      );
    });
  }

  const result = new Map<string, string>();
  users.forEach((u, i) => result.set(u, `cohort_${String.fromCharCode(97 + assignments[i])}`));
  return result;
}

export async function labelCohort(
  cohortSignals: WeightedSignal[],
  cohortSize: number,
  queryContext: string
): Promise<{ label: string; description: string }> {
  const topSignals = cohortSignals
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 12)
    .map(s => `${s.value} (${s.category}, score:${s.final_score.toFixed(2)})`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `You are a brand strategist. Label audience cohorts in 4-6 words that a marketer would immediately understand. Never use jargon. Use culturally specific language when appropriate.`,
    messages: [{
      role: 'user',
      content: `Brand query context: ${queryContext}
Cohort size: ${cohortSize} users
Top signals: ${topSignals.join('; ')}
Generate: {"label": "4-6 word cohort label", "description": "2 sentences max, second person, what makes this cohort distinctive and why the brand should care about them"}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(text);
  } catch {
    return { label: 'Audience Group', description: 'Matched users in this cohort.' };
  }
}

export async function buildLabeledCohorts(
  clusterAssignments: Map<string, string>,
  rankedResults: MatchResult[],
  vectors: Map<string, number[]>,
  rawPrompt: string
): Promise<CohortResult[]> {
  // Group users by cohort
  const cohortUsers = new Map<string, MatchResult[]>();
  for (const result of rankedResults) {
    const cohortId = clusterAssignments.get(result.user_google_sub) ?? 'cohort_a';
    if (!cohortUsers.has(cohortId)) cohortUsers.set(cohortId, []);
    cohortUsers.get(cohortId)!.push(result);
  }

  const cohorts: CohortResult[] = [];

  for (const [cohortId, users] of cohortUsers) {
    const cohortVecs = users
      .map(u => vectors.get(u.user_google_sub))
      .filter((v): v is number[] => v != null);

    // Compute centroid
    const dim = VECTOR_DIMENSIONS.length;
    const centroid = cohortVecs.length > 0
      ? Array.from({ length: dim }, (_, d) =>
          cohortVecs.reduce((sum, v) => sum + v[d], 0) / cohortVecs.length
        )
      : new Array(dim).fill(0);

    // Build top signals from centroid dimensions
    const topSignals: WeightedSignal[] = VECTOR_DIMENSIONS
      .map((name, i) => ({ value: name.replace(/_/g, ' '), category: 'dimension', final_score: centroid[i] }))
      .filter(s => s.final_score > 0.1)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 8);

    const { label, description } = await labelCohort(topSignals, users.length, rawPrompt);

    const avgScore = users.reduce((s, u) => s + u.match_score, 0) / users.length;
    const avgConf = users.reduce((s, u) => s + u.match_confidence, 0) / users.length;

    cohorts.push({
      cohort_id: cohortId,
      label,
      description,
      user_count: users.length,
      avg_match_score: avgScore,
      avg_confidence: avgConf,
      top_signals: topSignals,
      centroid_vector: centroid,
    });
  }

  return cohorts.sort((a, b) => b.user_count - a.user_count);
}

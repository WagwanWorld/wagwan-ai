import { getServiceSupabase } from '$lib/server/supabase';
import { VECTOR_DIMENSIONS, buildVectorFromSignalMeter, cosineSimilarity } from './cohortBuilder';
import type { LookalikeResult } from './types';

export async function expandToLookalikes(
  confirmedCohortIds: string[],
  queryId: string,
  expansionFactor: number = 3
): Promise<LookalikeResult[]> {
  const supabase = getServiceSupabase();

  // Get centroids of confirmed cohorts
  const { data: cohorts } = await supabase
    .from('brand_cohorts')
    .select('centroid_vector, user_count, label')
    .eq('query_id', queryId)
    .in('cohort_id', confirmedCohortIds);

  if (!cohorts?.length) return [];

  // Weighted average centroid across confirmed cohorts
  const totalUsers = cohorts.reduce((s, c) => s + (c.user_count ?? 0), 0);
  const dim = VECTOR_DIMENSIONS.length;
  const mergedCentroid = cohorts.reduce((acc, cohort) => {
    const w = (cohort.user_count ?? 0) / Math.max(totalUsers, 1);
    const cv: number[] = cohort.centroid_vector ?? new Array(dim).fill(0);
    return acc.map((v, i) => v + w * (cv[i] ?? 0));
  }, new Array(dim).fill(0) as number[]);

  // Get already-matched users to exclude
  const { data: existing } = await supabase
    .from('brand_audience_matches')
    .select('user_google_sub')
    .eq('query_id', queryId);
  const excludeSet = new Set(existing?.map(r => r.user_google_sub) ?? []);

  // Find users whose signal vectors are close to the merged centroid
  const { data: allUsers } = await supabase
    .from('identity_graphs')
    .select('google_sub, signal_meter')
    .not('signal_meter', 'is', null);

  const targetCount = totalUsers * expansionFactor;
  const scoredUsers: Array<{ sub: string; similarity: number }> = [];

  for (const user of allUsers ?? []) {
    if (excludeSet.has(user.google_sub)) continue;
    const vec = buildVectorFromSignalMeter(user.signal_meter);
    const similarity = cosineSimilarity(vec, mergedCentroid);
    if (similarity > 0.55) scoredUsers.push({ sub: user.google_sub, similarity });
  }

  return scoredUsers
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, targetCount)
    .map(u => ({ user_google_sub: u.sub, similarity_score: u.similarity, source: 'lookalike' as const }));
}

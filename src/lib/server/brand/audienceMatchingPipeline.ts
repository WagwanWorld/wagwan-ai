import { getServiceSupabase } from '$lib/server/supabase';
import { parseBrandPrompt } from './brandPromptParser';
import {
  matchDirectSignals,
  matchInferenceLayer,
  matchBehavioralPatterns,
  matchCorrelatedSignals,
  matchLooseAssociations,
  mergeAllTiers,
  rankAndScore,
  getOptedOutUsers,
} from './audienceMatcher';
import { expandQueryWithCorrelations } from './correlationExpander';
import { buildUserSignalVectors, kMeansClusters, buildLabeledCohorts } from './cohortBuilder';
import { generateMatchExplanation } from './matchExplainer';
import type {
  AudienceMatchResponse,
  MatchResult,
  MatchedUser,
  SignalCoverage,
  ExpandedSignal,
  CohortResult,
} from './types';

export type { AudienceMatchResponse };

export async function runAudienceMatchingPipeline(
  prompt: string,
  brandId: string,
  onProgress?: (step: string, count: number) => void,
): Promise<AudienceMatchResponse> {
  const t0 = Date.now();

  // Step 1: Parse brand prompt
  onProgress?.('parsing', 0);
  const intent = await parseBrandPrompt(prompt);

  // Step 2: Expand with correlations
  onProgress?.('expanding', 0);
  const expandedSignals = await expandQueryWithCorrelations(intent);

  // Step 3: Load opted-out users once
  const optedOut = await getOptedOutUsers();

  // Step 4: Run Tiers 1-3 in parallel
  onProgress?.('matching', 0);
  const [t1Results, t2Results, t3Results] = await Promise.all([
    matchDirectSignals(intent, optedOut),
    matchInferenceLayer(intent, new Set(), optedOut),
    matchBehavioralPatterns(intent, new Set(), optedOut),
  ]);

  const matchedSoFar = new Set([
    ...t1Results.map((r) => r.user_google_sub),
    ...t2Results.map((r) => r.user_google_sub),
    ...t3Results.map((r) => r.user_google_sub),
  ]);
  onProgress?.('matching', matchedSoFar.size);

  // Step 5: Tier 4 — correlation-based
  let t4Results: MatchResult[] = [];
  if (intent.min_tier >= 4 || matchedSoFar.size < 30) {
    t4Results = await matchCorrelatedSignals(expandedSignals, matchedSoFar, optedOut);
    t4Results.forEach((r) => matchedSoFar.add(r.user_google_sub));
    onProgress?.('matching', matchedSoFar.size);
  }

  // Step 6: Tier 5 — loose associations
  let t5Results: MatchResult[] = [];
  if (matchedSoFar.size < 20 || intent.min_tier >= 5) {
    t5Results = await matchLooseAssociations(intent, expandedSignals, matchedSoFar, optedOut);
    onProgress?.('matching', matchedSoFar.size + t5Results.length);
  }

  // Step 7: Merge and score
  const allResults = mergeAllTiers([t1Results, t2Results, t3Results, t4Results, t5Results]);
  const rankedResults = rankAndScore(allResults, intent);

  if (rankedResults.length === 0) {
    const queryId = await persistAudienceMatch({
      brandId,
      intent,
      expandedSignals,
      rankedResults,
      cohorts: [],
      processingMs: Date.now() - t0,
    });
    return {
      query_id: queryId,
      total_matched: 0,
      cohorts: [],
      tier_breakdown: {},
      top_users: [],
      signal_coverage: {
        total_signals_searched: 0,
        signals_with_matches: [],
        correlation_expansions_used: 0,
      },
      processing_ms: Date.now() - t0,
      correlation_expansions: [],
    };
  }

  // Step 8: Build signal vectors + cluster
  onProgress?.('clustering', rankedResults.length);
  const userIds = rankedResults.map((r) => r.user_google_sub);
  const vectors = await buildUserSignalVectors(userIds);
  const k = Math.min(intent.cohort_count, Math.max(2, Math.floor(userIds.length / 15)));
  const clusterAssignments = kMeansClusters(vectors, k);

  // Step 9: Label cohorts
  onProgress?.('labeling', 0);
  const cohorts = await buildLabeledCohorts(clusterAssignments, rankedResults, vectors, prompt);

  // Step 10: Persist
  const queryId = await persistAudienceMatch({
    brandId,
    intent,
    expandedSignals,
    rankedResults,
    cohorts,
    processingMs: Date.now() - t0,
  });

  // Step 11: Build response
  const tierBreakdown = countByTier(rankedResults);
  const topUsers = rankedResults
    .slice(0, 50)
    .map((r) => formatUserPreview(r, clusterAssignments, intent, expandedSignals));
  const signalCoverage = buildSignalCoverage(rankedResults, expandedSignals);

  return {
    query_id: queryId,
    total_matched: rankedResults.length,
    cohorts,
    tier_breakdown: tierBreakdown,
    top_users: topUsers,
    signal_coverage: signalCoverage,
    processing_ms: Date.now() - t0,
    correlation_expansions: expandedSignals.filter((s) => s.source === 'correlation'),
  };
}

export async function persistAudienceMatch(opts: {
  brandId: string;
  intent: import('./types').BrandQueryIntent;
  expandedSignals: ExpandedSignal[];
  rankedResults: MatchResult[];
  cohorts: CohortResult[];
  processingMs: number;
}): Promise<string> {
  const supabase = getServiceSupabase();
  const { brandId, intent, expandedSignals, rankedResults, cohorts, processingMs } = opts;

  // Insert brand query
  const { data: queryRow } = await supabase
    .from('brand_queries')
    .insert({
      brand_id: brandId,
      raw_prompt: intent.raw_prompt,
      parsed_intent: intent as unknown as Record<string, unknown>,
      expanded_signals: expandedSignals as unknown as Record<string, unknown>[],
      match_count: rankedResults.length,
      cohort_count: cohorts.length,
      processing_ms: processingMs,
      result_summary: {
        tier_breakdown: countByTier(rankedResults),
        cohort_labels: cohorts.map((c) => c.label),
      },
    })
    .select('id')
    .single();

  const queryId = queryRow?.id ?? crypto.randomUUID();

  // Batch insert matches (max 500)
  if (rankedResults.length > 0) {
    const matchRows = rankedResults.slice(0, 500).map((r) => ({
      query_id: queryId,
      user_google_sub: r.user_google_sub,
      match_tier: r.match_tier,
      match_score: r.match_score,
      match_confidence: r.match_confidence,
      matched_signals: r.matched_signals as unknown as Record<string, unknown>[],
      correlation_paths: (r.correlation_paths ?? []) as unknown as Record<string, unknown>[],
    }));
    await supabase.from('brand_audience_matches').insert(matchRows);
  }

  // Insert cohorts
  if (cohorts.length > 0) {
    const cohortRows = cohorts.map((c) => ({
      query_id: queryId,
      cohort_id: c.cohort_id,
      label: c.label,
      description: c.description,
      user_count: c.user_count,
      avg_match_score: c.avg_match_score,
      avg_confidence: c.avg_confidence,
      top_signals: c.top_signals as unknown as Record<string, unknown>[],
      centroid_vector: c.centroid_vector as unknown as Record<string, unknown>,
    }));
    await supabase.from('brand_cohorts').insert(cohortRows);
  }

  return queryId;
}

function countByTier(results: MatchResult[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const r of results) {
    counts[r.match_tier] = (counts[r.match_tier] ?? 0) + 1;
  }
  return counts;
}

function formatUserPreview(
  r: MatchResult,
  clusterAssignments: Map<string, string>,
  intent: import('./types').BrandQueryIntent,
  expandedSignals: ExpandedSignal[],
): MatchedUser {
  return {
    user_google_sub: r.user_google_sub,
    match_tier: r.match_tier,
    match_score: r.match_score,
    cohort_id: clusterAssignments.get(r.user_google_sub) ?? 'cohort_a',
    explanation: generateMatchExplanation(r, intent, expandedSignals),
  };
}

function buildSignalCoverage(
  results: MatchResult[],
  expandedSignals: ExpandedSignal[],
): SignalCoverage {
  const matchedSignalValues = new Set<string>();
  for (const r of results) {
    for (const sig of r.matched_signals as any[]) {
      if (sig?.value) matchedSignalValues.add(sig.value);
    }
  }
  return {
    total_signals_searched: expandedSignals.length,
    signals_with_matches: [...matchedSignalValues],
    correlation_expansions_used: expandedSignals.filter((s) => s.source === 'correlation').length,
  };
}

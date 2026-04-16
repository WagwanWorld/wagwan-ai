import { getServiceSupabase } from '$lib/server/supabase';
import type { BrandQueryIntent, MatchResult, ExpandedSignal } from './types';

// ---------------------------------------------------------------------------
// Privacy gate — fetch opted-out users fresh each pipeline run
// ---------------------------------------------------------------------------

export async function getOptedOutUsers(): Promise<Set<string>> {
  const supabase = getServiceSupabase();
  const PAGE_SIZE = 1000;
  const result = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('google_sub')
      .eq('brand_matching_opt_out', true)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    for (const r of data) result.add(r.google_sub);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tier 1 — Direct Signal Matching
// ---------------------------------------------------------------------------

function computeDirectMatchScore(
  claim: { confidence: number; salience_0_100: number },
  targetVal: string,
  intent: BrandQueryIntent
): number {
  return ((claim.salience_0_100 ?? 50) / 100) * (claim.confidence ?? 0.7);
}

export async function matchDirectSignals(
  intent: BrandQueryIntent,
  optedOut: Set<string>
): Promise<MatchResult[]> {
  const supabase = getServiceSupabase();

  const directTargets: string[] = [
    ...(intent.target_genres ?? []),
    ...(intent.target_aesthetics ?? []),
    ...(intent.target_interests ?? []),
    ...(intent.target_lifestyle ?? []),
    ...(intent.target_artists ?? []),
  ];

  const results: MatchResult[] = [];

  for (const val of directTargets) {
    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .ilike('assertion', `%${val}%`)
      .gte('confidence', 0.6)
      .order('salience_0_100', { ascending: false })
      .limit(200);

    if (error || !data) continue;

    for (const claim of data as any[]) {
      if (optedOut.has(claim.user_google_sub)) continue;

      const score = computeDirectMatchScore(
        { confidence: claim.confidence, salience_0_100: claim.salience_0_100 },
        val,
        intent
      );

      results.push({
        user_google_sub: claim.user_google_sub,
        match_tier: 1,
        match_score: score,
        match_confidence: claim.confidence ?? 0.7,
        matched_signals: [{ assertion: claim.assertion, value: val }],
        correlation_paths: [],
      });
    }
  }

  return deduplicateByUser(results);
}

// ---------------------------------------------------------------------------
// Tier 2 — Inference Layer Matching
// ---------------------------------------------------------------------------

function buildDomainQueries(intent: BrandQueryIntent): Array<{ query: string; weight: number }> {
  const queries: Array<{ query: string; weight: number }> = [];
  if (intent.target_interests?.length) {
    for (const interest of intent.target_interests) {
      queries.push({ query: interest, weight: 1.0 });
    }
  }
  if (intent.target_lifestyle?.length) {
    for (const lifestyle of intent.target_lifestyle) {
      queries.push({ query: lifestyle, weight: 0.9 });
    }
  }
  if (intent.target_purchase_category)
    queries.push({ query: intent.target_purchase_category, weight: 1.0 });
  if (intent.target_career_stage?.length) {
    for (const stage of intent.target_career_stage) {
      queries.push({ query: stage, weight: 0.85 });
    }
  }
  return queries;
}

export async function matchInferenceLayer(
  intent: BrandQueryIntent,
  existingMatches: Set<string>,
  optedOut: Set<string>
): Promise<MatchResult[]> {
  const supabase = getServiceSupabase();
  const domainQueries = buildDomainQueries(intent);
  const results: MatchResult[] = [];

  for (const dq of domainQueries) {
    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .eq('claim_kind', 'narrative')
      .ilike('assertion', `%${dq.query}%`)
      .gte('confidence', 0.65)
      .limit(200);

    if (error || !data) continue;

    for (const claim of data as any[]) {
      if (existingMatches.has(claim.user_google_sub)) continue;
      if (optedOut.has(claim.user_google_sub)) continue;

      const score = ((claim.salience_0_100 ?? 50) / 100) * (claim.confidence ?? 0.65) * dq.weight;

      results.push({
        user_google_sub: claim.user_google_sub,
        match_tier: 2,
        match_score: score,
        match_confidence: claim.confidence ?? 0.65,
        matched_signals: [{ assertion: claim.assertion, query: dq.query }],
        correlation_paths: [],
      });
    }
  }

  // Also match on intent classification
  if (intent.target_intent_type) {
    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .eq('claim_kind', 'intent')
      .ilike('assertion', `%${intent.target_intent_type}%`)
      .gte('confidence', 0.65)
      .limit(200);

    if (!error && data) {
      for (const claim of data as any[]) {
        if (existingMatches.has(claim.user_google_sub)) continue;
        if (optedOut.has(claim.user_google_sub)) continue;

        const score = ((claim.salience_0_100 ?? 50) / 100) * (claim.confidence ?? 0.65);

        results.push({
          user_google_sub: claim.user_google_sub,
          match_tier: 2,
          match_score: score,
          match_confidence: claim.confidence ?? 0.65,
          matched_signals: [{ assertion: claim.assertion, intent_type: intent.target_intent_type }],
          correlation_paths: [],
        });
      }
    }
  }

  return deduplicateByUser(results);
}

// ---------------------------------------------------------------------------
// Tier 3 — Behavioral Pattern Matching
// ---------------------------------------------------------------------------

function buildBehavioralClaimQueries(
  intent: BrandQueryIntent
): Array<{ pattern: string; weight: number }> {
  const queries: Array<{ pattern: string; weight: number }> = [];
  if (intent.target_purchase_window === '2_weeks') {
    queries.push({ pattern: 'purchase intent', weight: 1.0 });
    queries.push({ pattern: 'active shopper', weight: 0.9 });
  }
  if (intent.target_creator_tier)
    queries.push({ pattern: `creator tier: ${intent.target_creator_tier}`, weight: 0.85 });
  if (intent.target_engagement_tier === 'high') {
    queries.push({ pattern: 'high engagement', weight: 0.8 });
    queries.push({ pattern: 'rising engagement', weight: 0.75 });
  }
  if (intent.target_budget?.length) {
    for (const b of intent.target_budget)
      queries.push({ pattern: `budget: ${b}`, weight: 0.7 });
  }
  return queries;
}

export async function matchBehavioralPatterns(
  intent: BrandQueryIntent,
  existingMatches: Set<string>,
  optedOut: Set<string>
): Promise<MatchResult[]> {
  const supabase = getServiceSupabase();
  const patterns = buildBehavioralClaimQueries(intent);
  const results: MatchResult[] = [];

  for (const p of patterns) {
    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .eq('claim_kind', 'graph_fact')
      .ilike('assertion', `%${p.pattern}%`)
      .gte('salience_0_100', 40)
      .limit(200);

    if (error || !data) continue;

    for (const claim of data as any[]) {
      if (existingMatches.has(claim.user_google_sub)) continue;
      if (optedOut.has(claim.user_google_sub)) continue;

      const score = ((claim.salience_0_100 ?? 50) / 100) * p.weight;

      results.push({
        user_google_sub: claim.user_google_sub,
        match_tier: 3,
        match_score: score,
        match_confidence: claim.confidence ?? 0.65,
        matched_signals: [{ assertion: claim.assertion, pattern: p.pattern }],
        correlation_paths: [],
      });
    }
  }

  return deduplicateByUser(results);
}

// ---------------------------------------------------------------------------
// Tier 4 — Correlated Signal Matching
// ---------------------------------------------------------------------------

export async function matchCorrelatedSignals(
  expandedSignals: ExpandedSignal[],
  existingMatches: Set<string>,
  optedOut: Set<string>
): Promise<MatchResult[]> {
  const supabase = getServiceSupabase();
  const correlationSignals = expandedSignals.filter((s) => s.source === 'correlation');
  const results: MatchResult[] = [];

  for (const sig of correlationSignals) {
    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .ilike('assertion', `%${sig.value}%`)
      .gte('confidence', 0.5)
      .limit(150);

    if (error || !data) continue;

    for (const claim of data as any[]) {
      if (existingMatches.has(claim.user_google_sub)) continue;
      if (optedOut.has(claim.user_google_sub)) continue;

      const score =
        ((claim.salience_0_100 ?? 50) / 100) * (claim.confidence ?? 0.6) * sig.weight;

      const correlationPaths = sig.correlation_from
        ? [
            {
              from: sig.correlation_from,
              to: sig.value,
              lift: sig.lift,
              confidence: sig.confidence,
              domain_distance: sig.domain_distance,
            },
          ]
        : [];

      results.push({
        user_google_sub: claim.user_google_sub,
        match_tier: 4,
        match_score: score,
        match_confidence: claim.confidence ?? 0.6,
        matched_signals: [{ assertion: claim.assertion, signal_value: sig.value }],
        correlation_paths: correlationPaths,
      });
    }
  }

  return deduplicateByUser(results);
}

// ---------------------------------------------------------------------------
// Tier 5 — Loose Associations
// ---------------------------------------------------------------------------

export async function matchLooseAssociations(
  intent: BrandQueryIntent,
  expandedSignals: ExpandedSignal[],
  existingMatches: Set<string>,
  optedOut: Set<string>
): Promise<MatchResult[]> {
  const supabase = getServiceSupabase();

  const directTargets: string[] = [
    ...(intent.target_genres ?? []),
    ...(intent.target_aesthetics ?? []),
    ...(intent.target_interests ?? []),
    ...(intent.target_lifestyle ?? []),
    ...(intent.target_artists ?? []),
  ];

  const results: MatchResult[] = [];

  for (const val of directTargets) {
    if (results.length >= 50) break;

    const { data, error } = await supabase
      .from('user_identity_claims')
      .select('user_google_sub, assertion, confidence, salience_0_100, domain, claim_kind')
      .ilike('assertion', `%${val}%`)
      .gte('confidence', 0.4)
      .gte('salience_0_100', 20)
      .limit(50);

    if (error || !data) continue;

    for (const claim of data as any[]) {
      if (results.length >= 50) break;
      if (existingMatches.has(claim.user_google_sub)) continue;
      if (optedOut.has(claim.user_google_sub)) continue;

      const score =
        ((claim.salience_0_100 ?? 50) / 100) * (claim.confidence ?? 0.5) * 0.45;

      results.push({
        user_google_sub: claim.user_google_sub,
        match_tier: 5,
        match_score: score,
        match_confidence: claim.confidence ?? 0.5,
        matched_signals: [{ assertion: claim.assertion, value: val }],
        correlation_paths: [],
      });
    }
  }

  return deduplicateByUser(results);
}

// ---------------------------------------------------------------------------
// Composite Scoring
// ---------------------------------------------------------------------------

export function computeCompositeScore(user: MatchResult, intent: BrandQueryIntent): number {
  const tierWeight = [1.0, 0.85, 0.75, 0.65, 0.45][user.match_tier - 1];
  const signalCount = user.matched_signals.length;
  const multiSignalBoost = signalCount >= 3 ? 0.1 : signalCount >= 2 ? 0.05 : 0;
  const recentlyActive = user.last_sync_days != null && user.last_sync_days <= 7;
  const recencyBoost = recentlyActive ? 0.05 : 0;
  const momentumBoost = (user.momentum_score ?? 50) > 70 ? 0.08 : 0;
  const purchaseBoost =
    intent.target_purchase_window && (user.purchase_intent_score ?? 0) > 0.6 ? 0.1 : 0;
  const raw = user.match_score * tierWeight * user.match_confidence;
  return Math.min(raw + multiSignalBoost + recencyBoost + momentumBoost + purchaseBoost, 1.0);
}

// ---------------------------------------------------------------------------
// Merge and rank helpers
// ---------------------------------------------------------------------------

export function mergeAllTiers(tierResults: MatchResult[][]): MatchResult[] {
  const byUser = new Map<string, MatchResult>();
  for (const tier of tierResults) {
    for (const r of tier) {
      const existing = byUser.get(r.user_google_sub);
      if (!existing || r.match_score > existing.match_score) {
        byUser.set(r.user_google_sub, r);
      }
    }
  }
  return [...byUser.values()];
}

export function rankAndScore(results: MatchResult[], intent: BrandQueryIntent): MatchResult[] {
  return results
    .map((r) => ({ ...r, match_score: computeCompositeScore(r, intent) }))
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, intent.max_results);
}

export function deduplicateByUser(results: MatchResult[]): MatchResult[] {
  const byUser = new Map<string, MatchResult>();
  for (const r of results) {
    const existing = byUser.get(r.user_google_sub);
    if (!existing || r.match_score > existing.match_score) {
      byUser.set(r.user_google_sub, r);
    }
  }
  return [...byUser.values()];
}

export function mergeMatchResults(
  into: MatchResult[],
  newResults: Array<{ user_google_sub: string; confidence?: number; salience_0_100?: number }>,
  tier: 1 | 2 | 3 | 4 | 5,
  scoreMultiplier: number
): void {
  for (const r of newResults) {
    const score = ((r.salience_0_100 ?? 50) / 100) * (r.confidence ?? 0.65) * scoreMultiplier;
    into.push({
      user_google_sub: r.user_google_sub,
      match_tier: tier,
      match_score: score,
      match_confidence: r.confidence ?? 0.65,
      matched_signals: [],
      correlation_paths: [],
    });
  }
}

export { getOptedOutUsers };

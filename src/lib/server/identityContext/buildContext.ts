import { searchIdentityClaimsSemantic } from '$lib/server/identityClaims/queryClaims';
import type { WeightedSignal } from '$lib/types/signalMeter';
import type { PlatformBucket } from '$lib/types/intentWeights';
import type { CompressedContext, ContextSliceId, QueryIntent } from '$lib/types/contextPack';
import { classifyQuery, selectContextSlices, shouldEnrichWithClaims } from './classifyQuery';
import { compressContext } from './compressContext';
import { loadUserGraphContext, rowToExtractionContext } from './loadUserGraphContext';
import { getTopSignals } from './signalRanker';
import { applySliceAnchors, extractSlice } from './sliceExtractors';

function syntheticSignalsFromInference(assertions: string[], prefix: string): WeightedSignal[] {
  return assertions.slice(0, 5).map((value, i) => ({
    type: 'intent' as const,
    category: prefix,
    value: value.slice(0, 200),
    context: '',
    strength: 0.55 + i * 0.03,
    confidence: 0.65,
    recency: 0.55,
    frequency: 0.5,
    source: 'manual',
    platform_bucket: 'manual',
    platform_buckets: ['manual'] as PlatformBucket[],
    direction: 'neutral' as const,
    base_score: 0.6,
    final_score: 0.6,
    scores_by_intent: {},
  }));
}

/**
 * Full Context Builder pipeline: classify → select slices → rank signals → compress.
 */
export async function buildContext(googleSub: string, query: string): Promise<CompressedContext | null> {
  const loaded = await loadUserGraphContext(googleSub);
  if (!loaded) return null;

  const intent: QueryIntent = classifyQuery(query);
  const sliceIds = selectContextSlices(intent);
  const extCtx = rowToExtractionContext(loaded);

  const slices: Record<string, unknown> = {};
  for (const id of sliceIds) {
    if (id === 'top_signals') continue;
    const data = extractSlice(id, extCtx);
    if (data !== null && data !== undefined) slices[id] = data;
  }

  applySliceAnchors(sliceIds, slices, extCtx);

  const baseSignals = [...(loaded.signalMeter?.signals ?? [])];
  const cur = loaded.inference?.current;
  const evidenceLines =
    cur?.life_domains?.flatMap(d => (d.evidence ?? []).map(e => e.text)).filter(Boolean) ?? [];
  const mergedSignals = [...baseSignals, ...syntheticSignalsFromInference(evidenceLines, 'evidence')];
  const ranked = getTopSignals(mergedSignals, 10);

  if (sliceIds.includes('top_signals')) {
    slices.top_signals = ranked.map(s => ({
      type: s.type,
      category: s.category,
      value: s.value,
      score: s.score,
    }));
  }

  let claims_relevant: string[] = [];
  if (shouldEnrichWithClaims(intent)) {
    const rows = await searchIdentityClaimsSemantic(googleSub.trim(), query, 8);
    claims_relevant = rows.map(r => r.assertion);
  }

  return compressContext({
    query,
    intent,
    timestamp: new Date().toISOString(),
    sliceIds,
    slices,
    ranked_signals: ranked,
    claims_relevant,
  });
}

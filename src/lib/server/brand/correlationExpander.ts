import { getServiceSupabase } from '$lib/server/supabase';
import type { BrandQueryIntent, ExpandedSignal } from './types';

export async function expandQueryWithCorrelations(
  intent: BrandQueryIntent,
  maxExpansions: number = 20
): Promise<ExpandedSignal[]> {
  // Build direct signals from intent
  const directSignals: ExpandedSignal[] = [
    ...(intent.target_genres ?? []).map(v => ({ value: v, category: 'music genre', weight: 1.0, source: 'direct' as const })),
    ...(intent.target_aesthetics ?? []).map(v => ({ value: v, category: 'instagram descriptor', weight: 1.0, source: 'direct' as const })),
    ...(intent.target_interests ?? []).map(v => ({ value: v, category: 'profile interest', weight: 1.0, source: 'direct' as const })),
    ...(intent.target_artists ?? []).map(v => ({ value: v, category: 'music genre cluster', weight: 1.0, source: 'direct' as const })),
    ...(intent.target_brands ?? []).map(v => ({ value: v, category: 'brand vibe', weight: 1.0, source: 'direct' as const })),
    ...(intent.target_lifestyle ?? []).map(v => ({ value: v, category: 'lifestyle signal', weight: 0.9, source: 'direct' as const })),
  ];

  if (!intent.include_correlations) return directSignals;

  const supabase = getServiceSupabase();
  const expanded = [...directSignals];
  const alreadyTargeted = new Set(directSignals.map(s => s.value.toLowerCase()));

  for (const sig of directSignals) {
    if (expanded.length >= directSignals.length + maxExpansions) break;

    const { data: correlates } = await supabase
      .from('correlation_index')
      .select('signal_b, signal_b_cat, lift, confidence, domain_distance')
      .eq('signal_a', sig.value)
      .eq('is_active', true)
      .gte('lift', 1.3)
      .order('lift', { ascending: false })
      .limit(10);

    for (const corr of correlates ?? []) {
      if (alreadyTargeted.has(corr.signal_b.toLowerCase())) continue;
      if (expanded.length >= directSignals.length + maxExpansions) break;

      // Weight discount: same domain 0.90, adjacent 0.70, cross-domain 0.45
      const distancePenalty = corr.domain_distance === 1 ? 0.90 : corr.domain_distance === 2 ? 0.70 : 0.45;
      const liftBoost = Math.min((corr.lift - 1.0) / 3.0, 0.25);
      const correlationWeight = sig.weight * distancePenalty * (1 + liftBoost);

      expanded.push({
        value: corr.signal_b,
        category: corr.signal_b_cat,
        weight: Math.min(correlationWeight, 0.85),
        source: 'correlation',
        correlation_from: sig.value,
        lift: corr.lift,
        confidence: corr.confidence,
        domain_distance: corr.domain_distance,
      });
      alreadyTargeted.add(corr.signal_b.toLowerCase());
    }
  }

  return expanded;
}

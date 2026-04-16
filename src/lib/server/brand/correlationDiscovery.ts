import { getServiceSupabase } from '$lib/server/supabase';
import type { CorrelationInsert } from './types';

function normalizeSignalKey(value: string, category: string): string {
  return `${value.toLowerCase().trim()}::${category}`;
}

function computePearsonR(usersA: Set<string>, usersB: Set<string>, N: number): number {
  const intersection = [...usersA].filter(u => usersB.has(u)).length;
  const pA = usersA.size / N;
  const pB = usersB.size / N;
  const pAB = intersection / N;
  const numerator = pAB - pA * pB;
  const denominator = Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

const DOMAIN_MAP: Record<string, string> = {
  'music genre': 'music', 'music genre cluster': 'music',
  'brand vibe': 'commerce', 'caption mention': 'commerce',
  'instagram interest': 'lifestyle', 'instagram pattern': 'lifestyle',
  'lifestyle signal': 'behavior', 'calendar pattern': 'behavior',
  'professional skill': 'career', 'professional identity': 'career',
  'profile interest': 'declared', 'instagram descriptor': 'identity',
};

const ADJACENT: Record<string, string[]> = {
  'music': ['lifestyle', 'identity', 'commerce'],
  'lifestyle': ['music', 'behavior', 'identity'],
  'career': ['behavior', 'declared'],
  'commerce': ['lifestyle', 'declared'],
};

function computeDomainDistance(catA: string, catB: string): number {
  const domA = DOMAIN_MAP[catA] ?? catA;
  const domB = DOMAIN_MAP[catB] ?? catB;
  if (domA === domB) return 1;
  if (ADJACENT[domA]?.includes(domB)) return 2;
  return 3;
}

export async function runCorrelationDiscovery(): Promise<void> {
  console.log('[correlationDiscovery] Starting correlation discovery...');
  const supabase = getServiceSupabase();

  const { data: allSignalMeters } = await supabase
    .from('identity_graphs')
    .select('google_sub, signal_meter')
    .not('signal_meter', 'is', null);

  const users = allSignalMeters ?? [];
  const N = users.length;

  if (N < 50) {
    console.log(`[correlationDiscovery] Insufficient users (${N} < 50). Skipping.`);
    return;
  }

  // Build signal presence matrix: signal_key -> Set<user_sub>
  const signalPresence = new Map<string, Set<string>>();
  const signalMeta = new Map<string, { category: string }>();

  for (const user of users) {
    const signals: Array<{ value: string; category: string; final_score: number }> =
      (user.signal_meter as any)?.signals ?? [];

    for (const sig of signals) {
      if ((sig.final_score ?? 0) < 0.45) continue;
      const key = normalizeSignalKey(sig.value, sig.category);
      if (!signalPresence.has(key)) signalPresence.set(key, new Set());
      signalPresence.get(key)!.add(user.google_sub);
      if (!signalMeta.has(key)) signalMeta.set(key, { category: sig.category });
    }
  }

  // Compute pairwise association rules
  const correlations: CorrelationInsert[] = [];
  const signalKeys = [...signalPresence.keys()];

  for (let i = 0; i < signalKeys.length; i++) {
    const keyA = signalKeys[i];
    const usersA = signalPresence.get(keyA)!;
    if (usersA.size < 5) continue;

    for (let j = i + 1; j < signalKeys.length; j++) {
      const keyB = signalKeys[j];
      const usersB = signalPresence.get(keyB)!;
      if (usersB.size < 5) continue;

      const intersection = [...usersA].filter(u => usersB.has(u)).length;
      if (intersection < 3) continue;

      const supportA = usersA.size / N;
      const supportB = usersB.size / N;
      const supportAB = intersection / N;
      const confidence = supportAB / supportA;
      const lift = confidence / supportB;

      if (lift < 1.3 || confidence < 0.15) continue;

      const metaA = signalMeta.get(keyA)!;
      const metaB = signalMeta.get(keyB)!;
      const domainDist = computeDomainDistance(metaA.category, metaB.category);
      const sigAValue = keyA.split('::')[0];
      const sigBValue = keyB.split('::')[0];

      correlations.push({
        signal_a: sigAValue, signal_a_cat: metaA.category,
        signal_b: sigBValue, signal_b_cat: metaB.category,
        correlation_r: computePearsonR(usersA, usersB, N),
        support_count: intersection, lift, confidence,
        domain_distance: domainDist,
      });
      // Bidirectional
      correlations.push({
        signal_a: sigBValue, signal_a_cat: metaB.category,
        signal_b: sigAValue, signal_b_cat: metaA.category,
        correlation_r: computePearsonR(usersB, usersA, N),
        support_count: intersection,
        lift: (supportAB / supportB) / supportA,
        confidence: supportAB / supportB,
        domain_distance: domainDist,
      });
    }
  }

  // Bulk upsert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < correlations.length; i += BATCH_SIZE) {
    const batch = correlations.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('correlation_index')
      .upsert(batch, { onConflict: 'signal_a,signal_b' });
    if (error) console.error('[correlationDiscovery] Upsert error:', error.message);
  }

  console.log(`[correlationDiscovery] Discovered ${correlations.length} correlations across ${N} users`);
}

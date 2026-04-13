import type { ContextSliceId, QueryIntent } from '$lib/types/contextPack';

/** Intent → logical slices (see plan CONTEXT_MAP). */
export const CONTEXT_MAP: Record<QueryIntent, ContextSliceId[]> = {
  action: ['current_state', 'decision_layer', 'recency_signals', 'top_misalignment'],
  identity: ['persona', 'identity_tags', 'archetype', 'vibe'],
  growth: ['behavior_patterns', 'content_profile', 'gaps', 'trajectory'],
  taste: ['lifestyle', 'taste_profile', 'brands', 'music', 'media'],
  prediction: ['prediction_layer', 'trajectory', 'momentum', 'economic_profile'],
  decision: ['prediction_layer', 'risk_flags', 'opportunity_layer', 'behavior_patterns'],
  exploration: ['persona', 'current_state', 'top_signals', 'prediction_layer'],
};

const CLAIMS_INTENTS: ReadonlySet<QueryIntent> = new Set(['taste', 'identity', 'exploration']);

export function shouldEnrichWithClaims(intent: QueryIntent): boolean {
  return CLAIMS_INTENTS.has(intent);
}

/**
 * Deterministic intent classifier. Order matters: specific phrases before broad tokens.
 * Later: optional LLM classifier behind a flag.
 */
export function classifyQuery(query: string): QueryIntent {
  const q = query.toLowerCase().trim();

  if (!q) return 'exploration';

  if (q.includes('what should i do') || /\bwhat should i\b/.test(q)) return 'action';
  if (q.includes('who am i') || q.includes("who i'm") || /\bdescribe me\b/.test(q)) return 'identity';
  if (q.includes('should i ') || q.startsWith('should i')) return 'decision';
  if (/\b(how do i|how can i)\s+(grow|improve|get better)\b/.test(q) || /\bgrow(th)?\b/.test(q) || /\bimprove\b/.test(q)) {
    return 'growth';
  }
  if (/\bwhat do i like\b/.test(q) || /\bmy taste\b/.test(q) || /\bi like\b/.test(q) || /\btaste\b/.test(q)) {
    return 'taste';
  }
  if (/\bpredict\b/.test(q) || /\bwhat will\b/.test(q) || /\bwill i\b/.test(q)) return 'prediction';

  return 'exploration';
}

export function selectContextSlices(intent: QueryIntent): ContextSliceId[] {
  return [...(CONTEXT_MAP[intent] ?? CONTEXT_MAP.exploration)];
}

/**
 * Expression Engine — unified signals, atoms, vibes, and module-facing payloads.
 * Safe to serialize under identity_graph.expressionLayer.
 */

export const EXPRESSION_LAYER_VERSION = 1 as const;

/** Canonical signal row (normalized from meter + inference layers). */
export interface UnifiedSignal {
  type: string;
  value: string;
  confidence: number;
  recency: number;
  frequency: number;
  source: string;
  /** confidence*0.4 + recency*0.3 + frequency*0.3 */
  strength_score: number;
  category?: string;
  context?: string;
}

export interface IdentityAtom {
  label: string;
  strength: number;
  category: string;
}

export interface VibeCluster {
  id: string;
  name: string;
  /** Atom labels belonging to this vibe */
  atoms: string[];
  strength: number;
}

export interface ExpressionLayer {
  version: typeof EXPRESSION_LAYER_VERSION;
  generatedAt: string;
  unifiedSignals: UnifiedSignal[];
  atoms: IdentityAtom[];
  vibes: VibeCluster[];
}

export type ConfidenceTier = 'high' | 'medium' | 'low';

export function tierFromConfidence(c: number): ConfidenceTier {
  if (c >= 0.72) return 'high';
  if (c >= 0.45) return 'medium';
  return 'low';
}

export interface ExpressionFeedbackState {
  votes: Array<{
    targetId: string;
    vote: 'up' | 'down';
    at: string;
    ref?: string;
  }>;
  /** Normalized atom label -> dampen/boost delta applied on next build */
  atomNudges: Record<string, number>;
}

export interface ShopItemPayload {
  item: string;
  reason: string;
  confidence: number;
  tier: ConfidenceTier;
}

export interface MoodboardPayload {
  imageQueries: string[];
  colors: string[];
  textures: string[];
}

export interface CurrentVibePayload {
  label: string;
  confidence: number;
}

export interface MicroSuggestionPayload {
  text: string;
  confidence: number;
}

export interface ContradictionPayload {
  line: string;
  confidence: number;
}

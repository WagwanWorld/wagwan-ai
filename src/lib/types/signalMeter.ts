/** Weighted signal layer that sits before the identity graph builder. */

import type { IntentType, PlatformBucket } from '$lib/types/intentWeights';

export type SignalMeterType =
  | 'behavior'
  | 'interest'
  | 'taste'
  | 'intent'
  | 'network'
  | 'consumption'
  | 'transaction';

export type SignalMeterDirection = 'positive' | 'negative' | 'neutral';

export interface WeightedSignal {
  type: SignalMeterType;
  category: string;
  value: string;
  context: string;
  strength: number;
  confidence: number;
  recency: number;
  frequency: number;
  source: string;
  /** Primary bucket for this signal (first-resolved platform). */
  platform_bucket: PlatformBucket;
  /** Distinct platform buckets contributing (for cross-platform boosts). */
  platform_buckets: PlatformBucket[];
  direction: SignalMeterDirection;
  /** Fused score (strength/recency/frequency/confidence + cross-platform boost), before per-intent multipliers. */
  base_score: number;
  /** Same as base_score — used for graph thresholds and sorting (stable vs pre-intent-only pipeline). */
  final_score: number;
  /** Per-intent: base_score × avg platform weight for that intent mode. */
  scores_by_intent: Partial<Record<IntentType, number>>;
}

export interface SignalCluster {
  theme: string;
  signals: string[];
  intensity: number;
}

export interface SignalNoiseItem {
  reason: string;
  discarded_signal: string;
}

export interface SignalMeterOutput {
  signals: WeightedSignal[];
  clusters: SignalCluster[];
  dominant_patterns: string[];
  noise: SignalNoiseItem[];
}


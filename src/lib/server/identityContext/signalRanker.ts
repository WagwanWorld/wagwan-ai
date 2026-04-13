import type { WeightedSignal } from '$lib/types/signalMeter';

export type RankedWeightedSignal = WeightedSignal & { score: number };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Plan weights: strength, recency, frequency, confidence (each 0–1). */
export function computeSignalScore(s: WeightedSignal): number {
  const strength = clamp01(s.strength);
  const recency = clamp01(s.recency);
  const frequency = clamp01(s.frequency);
  const confidence = clamp01(s.confidence);
  return strength * 0.4 + recency * 0.3 + frequency * 0.2 + confidence * 0.1;
}

export function getTopSignals(signals: WeightedSignal[], limit = 8): RankedWeightedSignal[] {
  return [...signals]
    .map(s => ({ ...s, score: computeSignalScore(s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

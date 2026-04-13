/** Expression Engine — strength score (parallel to signalMeter base_score). */

export function computeSignalStrengthScore(input: {
  confidence: number;
  recency: number;
  frequency: number;
}): number {
  const { confidence, recency, frequency } = input;
  return Math.max(
    0,
    Math.min(1, confidence * 0.4 + recency * 0.3 + frequency * 0.3),
  );
}

const TOP_SIGNAL_MIN = 30;
const TOP_SIGNAL_MAX = 50;
const NOISE_THRESHOLD = 0.3;

export function selectTopUnifiedSignals<T extends { strength_score: number }>(
  signals: T[],
): T[] {
  const sorted = [...signals].sort((a, b) => b.strength_score - a.strength_score);
  const filtered = sorted.filter(s => s.strength_score >= NOISE_THRESHOLD);
  const cap = Math.min(TOP_SIGNAL_MAX, Math.max(TOP_SIGNAL_MIN, filtered.length));
  return filtered.slice(0, cap);
}

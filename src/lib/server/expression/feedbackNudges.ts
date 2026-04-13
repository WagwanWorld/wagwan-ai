import type { UnifiedSignal } from '$lib/types/expressionLayer';

/** Apply user feedback nudges (+/-) to matching signal rows by substring overlap. */
export function applyAtomNudges(
  signals: UnifiedSignal[],
  nudges?: Record<string, number>,
): UnifiedSignal[] {
  if (!nudges || !Object.keys(nudges).length) return signals;
  return signals.map(s => {
    let deltaSum = 0;
    const lv = s.value.toLowerCase();
    for (const [label, delta] of Object.entries(nudges)) {
      const t = label.trim().toLowerCase();
      if (!t || typeof delta !== 'number' || !Number.isFinite(delta)) continue;
      if (lv.includes(t) || t.includes(lv)) deltaSum += delta;
    }
    const bump = Math.max(-0.2, Math.min(0.2, deltaSum * 0.05));
    const strength_score = Math.max(0, Math.min(1, s.strength_score + bump));
    return { ...s, strength_score };
  });
}

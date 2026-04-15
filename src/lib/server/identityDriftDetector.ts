/**
 * Identity changes over time. Detects rising/fading signals and
 * identity transitions (e.g. consumer → creator).
 */

interface WeightedSignalLike {
  value: string;
  final_score: number;
  category?: string;
}

export interface DriftVector {
  rising: Array<{ value: string; delta: number; dimension: string }>;
  fading: Array<{ value: string; delta: number; dimension: string }>;
  stable: Array<{ value: string; score: number }>;
  transition_signal: string | null;
  drift_intensity: number;
}

export function computeIdentityDrift(
  currentSignals: WeightedSignalLike[],
  priorSignals: WeightedSignalLike[] | null,
): DriftVector {
  if (!priorSignals || priorSignals.length === 0) {
    return {
      rising: [], fading: [],
      stable: currentSignals.slice(0, 5).map(s => ({ value: s.value, score: s.final_score })),
      transition_signal: null, drift_intensity: 0,
    };
  }

  const priorMap = new Map(priorSignals.map(s => [s.value, s.final_score]));
  const rising: DriftVector['rising'] = [];
  const fading: DriftVector['fading'] = [];
  const stable: DriftVector['stable'] = [];

  for (const sig of currentSignals) {
    const prior = priorMap.get(sig.value) ?? 0;
    const delta = sig.final_score - prior;
    if (delta > 0.08) rising.push({ value: sig.value, delta, dimension: sig.category ?? 'unknown' });
    else if (delta < -0.08) fading.push({ value: sig.value, delta: Math.abs(delta), dimension: sig.category ?? 'unknown' });
    else if (sig.final_score > 0.6) stable.push({ value: sig.value, score: sig.final_score });
  }

  for (const [val, score] of priorMap) {
    if (!currentSignals.find(s => s.value === val) && score > 0.5) {
      fading.push({ value: val, delta: score, dimension: 'lost_signal' });
    }
  }

  const drift_intensity = Math.min((rising.length + fading.length) / 10, 1.0);

  let transition_signal: string | null = null;
  const risingLabels = rising.map(r => r.value.toLowerCase()).join(' ');
  const fadingLabels = fading.map(f => f.value.toLowerCase()).join(' ');
  if (/founder|shipping|building/.test(risingLabels) && /consume|passive/.test(fadingLabels))
    transition_signal = 'transitioning from consumer to builder';
  if (/creator|posting|content/.test(risingLabels))
    transition_signal = 'emerging creator identity';
  if (/travel|explore/.test(risingLabels) && drift_intensity > 0.3)
    transition_signal = 'entering travel planning phase';

  return {
    rising: rising.sort((a, b) => b.delta - a.delta).slice(0, 5),
    fading: fading.sort((a, b) => b.delta - a.delta).slice(0, 5),
    stable: stable.slice(0, 10),
    transition_signal, drift_intensity,
  };
}

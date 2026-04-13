/**
 * Merge deterministic signal meter rows + inference/hyper snippets into UnifiedSignal[].
 */
import type { IdentityGraph } from '$lib/server/identity';
import type { UnifiedSignal } from '$lib/types/expressionLayer';
import type { WeightedSignal } from '$lib/types/signalMeter';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import { buildSignalMeter } from '$lib/server/signalMeter';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import type { HyperInferenceWrapper } from '$lib/types/hyperInference';
import { computeSignalStrengthScore } from './signalStrength';
import { applyAtomNudges } from './feedbackNudges';

const GENERIC_VALUES = new Set([
  'music',
  'food',
  'travel',
  'design',
  'fashion',
  'lifestyle',
  'content',
  'business',
  'work',
]);

function isGenericValue(value: string): boolean {
  return GENERIC_VALUES.has(value.trim().toLowerCase());
}

function weightedToUnified(ws: WeightedSignal): UnifiedSignal {
  const strength_score = computeSignalStrengthScore({
    confidence: ws.confidence,
    recency: ws.recency,
    frequency: ws.frequency,
  });
  return {
    type: ws.type,
    value: ws.value,
    confidence: ws.confidence,
    recency: ws.recency,
    frequency: ws.frequency,
    source: ws.source,
    strength_score,
    category: ws.category,
    context: ws.context,
  };
}

function snip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function pushInferenceSignals(
  out: UnifiedSignal[],
  wrap: InferenceIdentityWrapper | null | undefined,
  inferredAt: string,
): void {
  if (!wrap?.current) return;
  const c = wrap.current;
  const recency = Number.isFinite(Date.parse(inferredAt))
    ? recencyFromIso(inferredAt)
    : 0.55;

  const add = (
    type: string,
    value: string,
    confidence: number,
    frequency: number,
    source: string,
    category?: string,
  ) => {
    const v = snip(value, 120);
    if (!v || v.length < 3 || isGenericValue(v)) return;
    const strength_score = computeSignalStrengthScore({
      confidence,
      recency,
      frequency,
    });
    out.push({
      type,
      value: v,
      confidence,
      recency,
      frequency,
      source,
      strength_score,
      category,
      context: 'inference_identity',
    });
  };

  add('intent', c.intent.primary, Math.min(0.95, 0.55 + c.intent.confidence * 0.4), 0.9, 'inference');
  for (const [i, s] of (c.interests?.latent ?? []).slice(0, 8).entries()) {
    add('interest', s, 0.62, 0.85 - i * 0.04, 'inference', 'latent_interest');
  }
  for (const [i, s] of (c.interests?.explicit ?? []).slice(0, 6).entries()) {
    add('interest', s, 0.68, 0.88 - i * 0.04, 'inference', 'explicit_interest');
  }
  for (const d of (c.life_domains ?? []).slice(0, 8)) {
    const sigs = Array.isArray(d.signals) ? d.signals : [];
    for (const [j, sig] of sigs.slice(0, 3).entries()) {
      add(d.id, sig, Math.min(0.9, 0.5 + d.confidence * 0.45), 0.82 - j * 0.03, 'inference', 'life_domain_signal');
    }
  }
  if (c.predictive_read?.you_in_one_line) {
    add(
      'behavior',
      c.predictive_read.you_in_one_line,
      0.7,
      0.75,
      'inference',
      'predictive',
    );
  }
}

function recencyFromIso(iso: string): number {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0.45;
  const ageMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs <= day) return 1;
  if (ageMs <= 7 * day) return 0.85;
  if (ageMs <= 30 * day) return 0.65;
  if (ageMs <= 90 * day) return 0.4;
  return 0.22;
}

function pushHyperSignals(out: UnifiedSignal[], hyper: HyperInferenceWrapper | null | undefined): void {
  if (!hyper) return;
  const generatedAt = hyper.generatedAt;
  const recency = recencyFromIso(generatedAt);
  const add = (type: string, value: string, confidence: number, frequency: number, category?: string) => {
    const v = snip(value, 160);
    if (!v || v.length < 4) return;
    out.push({
      type,
      value: v,
      confidence,
      recency,
      frequency,
      source: 'hyper_inference',
      strength_score: computeSignalStrengthScore({ confidence, recency, frequency }),
      category,
      context: 'hyper_inference',
    });
  };

  if (hyper.version === 2) {
    const p = hyper.payload;
    for (const x of (p.non_obvious_insights ?? []).slice(0, 6)) {
      add('insight', x, 0.72, 0.78, 'non_obvious');
    }
    for (const x of (p.depth_layer.core_drivers ?? []).slice(0, 5)) {
      add('driver', x, 0.68, 0.8, 'core_driver');
    }
    for (const x of (p.inference_layer.frictions ?? []).slice(0, 4)) {
      add('friction', x, 0.64, 0.75, 'friction');
    }
    for (const x of (p.lifestyle.fashion ?? []).slice(0, 4)) {
      add('fashion', x, 0.66, 0.77, 'lifestyle_fashion');
    }
    for (const x of (p.lifestyle.music ?? []).slice(0, 4)) {
      add('music', x, 0.66, 0.77, 'lifestyle_music');
    }
  } else {
    const p = hyper.payload;
    for (const x of (p.non_obvious_insights ?? []).slice(0, 6)) {
      add('insight', x, 0.7, 0.76, 'non_obvious');
    }
    for (const x of (p.depth_layer.core_drivers ?? []).slice(0, 5)) {
      add('driver', x, 0.66, 0.78, 'core_driver');
    }
    for (const x of (p.taste_profile.aesthetic_bias ?? []).slice(0, 5)) {
      add('taste', x, 0.64, 0.74, 'aesthetic');
    }
  }
}

function dedupeSignals(signals: UnifiedSignal[]): UnifiedSignal[] {
  const seen = new Set<string>();
  const out: UnifiedSignal[] = [];
  for (const s of signals) {
    const k = `${s.source}:${s.value.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export interface CollectUnifiedSignalsInput {
  mergedProfile: Record<string, unknown>;
  graph: IdentityGraph;
  signalMeter?: SignalMeterOutput | null;
  atomNudges?: Record<string, number>;
}

/**
 * Build full unified list from meter + graph layers, apply nudges, dedupe.
 */
export function collectUnifiedSignals(input: CollectUnifiedSignalsInput): UnifiedSignal[] {
  const meter =
    input.signalMeter ??
    buildSignalMeter(input.mergedProfile as Parameters<typeof buildSignalMeter>[0]);
  const fromMeter = meter.signals.map(weightedToUnified);

  const out: UnifiedSignal[] = [...fromMeter];

  const inf = input.graph.inferenceIdentity as InferenceIdentityWrapper | undefined;
  if (inf?.current) {
    pushInferenceSignals(out, inf, inf.inferredAt);
  }
  pushHyperSignals(out, input.graph.hyperInference ?? null);

  let merged = dedupeSignals(out);
  merged = applyAtomNudges(merged, input.atomNudges);
  return merged;
}

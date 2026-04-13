/**
 * Project precalc + signals + optional inference/hyper into a compact memory graph.
 */

import type { BehavioralPrecalcResult } from '$lib/server/behavioralPrecalc';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';
import { parseHyperInferenceWrapper } from '$lib/server/marketplace/hyperInferenceSchema';
import {
  HYPER_INFERENCE_SCHEMA_VERSION_V2,
  type HyperInferenceWrapper,
} from '$lib/types/hyperInference';
import type { MemoryGraphEdge, MemoryGraphNode, MemoryGraphProjection } from '$lib/types/memoryGraph';
import { MEMORY_GRAPH_SCHEMA_VERSION } from '$lib/types/memoryGraph';
import type { SignalMeterOutput } from '$lib/types/signalMeter';

function uid(prefix: string, s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 48);
  return `${prefix}_${slug || 'x'}`;
}

export function projectMemoryGraph(input: {
  precalc: BehavioralPrecalcResult;
  signalMeter: SignalMeterOutput;
  inferenceIdentity: unknown;
  hyperInference: unknown;
}): MemoryGraphProjection {
  const { precalc, signalMeter } = input;
  const nodes: MemoryGraphNode[] = [];
  const edges: MemoryGraphEdge[] = [];
  const t = Date.now();

  nodes.push({
    id: 'user_root',
    type: 'user',
    label: 'user',
    weight: 1,
  });

  const intentId = uid('intent', input.precalc.primary_intent_type);
  nodes.push({
    id: intentId,
    type: 'intent_mode',
    label: input.precalc.primary_intent_type,
    weight: input.precalc.intent_scores[input.precalc.primary_intent_type],
  });
  edges.push({
    id: `e_${intentId}_user`,
    from: 'user_root',
    to: intentId,
    type: 'derived_from',
    label: 'primary_intent',
  });

  for (const [plat, on] of Object.entries(input.precalc.platform_connected)) {
    if (!on) continue;
    const pid = uid('plat', plat);
    nodes.push({ id: pid, type: 'platform', label: plat });
    edges.push({
      id: `e_user_${pid}`,
      from: 'user_root',
      to: pid,
      type: 'observed_on',
    });
  }

  for (const th of input.precalc.cross_platform_themes.slice(0, 8)) {
    const tid = uid('theme', th.theme + th.platforms.join('-'));
    nodes.push({
      id: tid,
      type: 'theme',
      label: th.label,
      weight: th.tier >= 3 ? 0.95 : 0.75,
      meta: { tier: th.tier, platforms: th.platforms },
    });
    edges.push({
      id: `e_${tid}_intent`,
      from: tid,
      to: intentId,
      type: 'reinforces',
    });
    if (th.tier >= 3) {
      edges.push({
        id: `e_${tid}_truth`,
        from: tid,
        to: 'user_root',
        type: 'high_confidence_truth',
      });
    }
  }

  for (const neg of input.precalc.negative_signals) {
    const nid = uid('neg', neg.pattern);
    nodes.push({
      id: nid,
      type: 'negative_pattern',
      label: neg.pattern,
      meta: { implication: neg.implication },
    });
    edges.push({
      id: `e_${nid}_dampen`,
      from: nid,
      to: intentId,
      type: 'dampens',
      label: neg.dampens.join(','),
    });
  }

  const platSeen = new Set(nodes.filter(n => n.type === 'platform').map(n => n.id));

  for (const s of signalMeter.signals.slice(0, 24)) {
    const sid = uid('sig', `${s.category}:${s.value}`);
    const platId = uid('plat', s.platform_bucket);
    if (!platSeen.has(platId)) {
      platSeen.add(platId);
      nodes.push({ id: platId, type: 'platform', label: s.platform_bucket });
      edges.push({
        id: `e_user_${platId}`,
        from: 'user_root',
        to: platId,
        type: 'observed_on',
      });
    }
    nodes.push({
      id: sid,
      type: 'signal',
      label: s.value.slice(0, 120),
      weight: s.final_score,
      meta: {
        category: s.category,
        platform_bucket: s.platform_bucket,
        type: s.type,
      },
    });
    edges.push({
      id: `e_${sid}_${platId}`,
      from: sid,
      to: platId,
      type: 'observed_on',
    });
  }

  const inf = parseInferenceIdentityWrapper(input.inferenceIdentity);
  if (inf?.current?.intent?.primary) {
    nodes.push({
      id: 'inference_intent',
      type: 'theme',
      label: inf.current.intent.primary.slice(0, 200),
      weight: inf.current.intent.confidence,
    });
    edges.push({ id: 'e_inf_user', from: 'inference_intent', to: 'user_root', type: 'derived_from' });
  }

  const hyper = parseHyperInferenceWrapper(input.hyperInference) as HyperInferenceWrapper | null;
  if (hyper?.version === HYPER_INFERENCE_SCHEMA_VERSION_V2) {
    for (const p of hyper.payload.prediction_layer.slice(0, 8)) {
      const pid = uid('pred', p.action + p.timeframe);
      nodes.push({
        id: pid,
        type: 'prediction',
        label: p.action.slice(0, 160),
        weight: p.probability,
        meta: { timeframe: p.timeframe, confidence: p.confidence },
      });
      edges.push({ id: `e_${pid}_user`, from: pid, to: 'user_root', type: 'derived_from' });
    }
  }

  return {
    version: MEMORY_GRAPH_SCHEMA_VERSION,
    generatedAt: new Date(t).toISOString(),
    nodes,
    edges,
  };
}

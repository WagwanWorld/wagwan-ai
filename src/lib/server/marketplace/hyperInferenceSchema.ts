/**
 * Runtime parse for identity_graph.hyperInference (server).
 * Types live in `$lib/types/hyperInference`.
 */

import {
  HYPER_INFERENCE_SCHEMA_VERSION_V1,
  HYPER_INFERENCE_SCHEMA_VERSION_V2,
  type HyperInferenceConfidenceBySource,
  type HyperInferenceDepthLayer,
  type HyperInferenceEconomicProfile,
  type HyperInferenceEconomicProfileV2,
  type HyperInferenceIdentityBlock,
  type HyperInferenceInferenceLayer,
  type HyperInferenceInferenceLayerV2,
  type HyperInferenceDepthLayerV2,
  type HyperInferenceLifestyleV2,
  type HyperInferencePayload,
  type HyperInferencePayloadV2,
  type HyperInferencePredictionItemV2,
  type HyperInferencePredictionLayer,
  type HyperInferenceSelfPerceptionVsReality,
  type HyperInferenceTasteProfile,
  type HyperInferenceConfidenceMatrix,
  type HyperInferenceWrapper,
} from '$lib/types/hyperInference';
import type { IntentType } from '$lib/types/intentWeights';
import { INTENT_TYPES } from '$lib/types/intentWeights';

export type { HyperInferencePayload, HyperInferencePayloadV2, HyperInferenceWrapper } from '$lib/types/hyperInference';
export {
  HYPER_INFERENCE_SCHEMA_VERSION_V1,
  HYPER_INFERENCE_SCHEMA_VERSION_V2,
} from '$lib/types/hyperInference';

/** @deprecated */
export const HYPER_INFERENCE_SCHEMA_VERSION = HYPER_INFERENCE_SCHEMA_VERSION_V1;

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function str(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function strArr(x: unknown, max = 50): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, max);
}

function num01(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function num01Record(x: unknown): Record<string, number> {
  if (!isObj(x)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = Math.min(1, Math.max(0, v));
    }
  }
  return out;
}

function parseDepth(raw: unknown): HyperInferenceDepthLayer | null {
  if (!isObj(raw)) return null;
  const taste_mechanism = str(raw.taste_mechanism);
  if (!taste_mechanism) return null;
  return {
    core_drivers: strArr(raw.core_drivers),
    decision_patterns: strArr(raw.decision_patterns),
    attention_patterns: strArr(raw.attention_patterns),
    taste_mechanism,
    behavioral_loops: strArr(raw.behavioral_loops),
  };
}

function parseSelfVsReality(raw: unknown): HyperInferenceSelfPerceptionVsReality | null {
  if (!isObj(raw)) return null;
  const self_view = str(raw.self_view);
  const actual_behavior = str(raw.actual_behavior);
  if (!self_view || !actual_behavior) return null;
  return { self_view, actual_behavior };
}

function parseInferenceLayer(raw: unknown): HyperInferenceInferenceLayer | null {
  if (!isObj(raw)) return null;
  const true_intent = str(raw.true_intent);
  const identity_gap = str(raw.identity_gap);
  const spr = parseSelfVsReality(raw.self_perception_vs_reality);
  if (!true_intent || !identity_gap || !spr) return null;
  return {
    true_intent,
    hidden_goals: strArr(raw.hidden_goals),
    motivations: strArr(raw.motivations),
    frictions: strArr(raw.frictions),
    identity_gap,
    self_perception_vs_reality: spr,
  };
}

function parsePredictionLayer(raw: unknown): HyperInferencePredictionLayer | null {
  if (!isObj(raw)) return null;
  return {
    next_7_days: strArr(raw.next_7_days),
    next_30_days: strArr(raw.next_30_days),
    likely_purchases: strArr(raw.likely_purchases),
    likely_content_consumption: strArr(raw.likely_content_consumption),
    likely_behavior_shifts: strArr(raw.likely_behavior_shifts),
  };
}

function parseEconomic(raw: unknown): HyperInferenceEconomicProfile | null {
  if (!isObj(raw)) return null;
  const spending_style = str(raw.spending_style);
  const price_sensitivity = str(raw.price_sensitivity);
  if (!spending_style || !price_sensitivity) return null;
  return {
    spending_style,
    price_sensitivity,
    purchase_triggers: strArr(raw.purchase_triggers),
    brand_affinity: strArr(raw.brand_affinity),
    conversion_probability: num01Record(raw.conversion_probability),
  };
}

function parseTaste(raw: unknown): HyperInferenceTasteProfile | null {
  if (!isObj(raw)) return null;
  return {
    aesthetic_bias: strArr(raw.aesthetic_bias),
    music_evolution: strArr(raw.music_evolution),
    content_bias: strArr(raw.content_bias),
    emerging_interests: strArr(raw.emerging_interests),
  };
}

function parseConfidence(raw: unknown): HyperInferenceConfidenceMatrix | null {
  if (!isObj(raw)) return null;
  return {
    high_confidence: strArr(raw.high_confidence),
    medium_confidence: strArr(raw.medium_confidence),
    low_confidence: strArr(raw.low_confidence),
  };
}

export function parseHyperInferencePayloadV1(raw: unknown): HyperInferencePayload | null {
  if (!isObj(raw)) return null;

  const depth = parseDepth(raw.depth_layer);
  const inference = parseInferenceLayer(raw.inference_layer);
  const prediction = parsePredictionLayer(raw.prediction_layer);
  const economic = parseEconomic(raw.economic_profile);
  const taste = parseTaste(raw.taste_profile);
  const confidence = parseConfidence(raw.confidence_matrix);
  const non_obvious = strArr(raw.non_obvious_insights, 20);

  if (!depth || !inference || !prediction || !economic || !taste || !confidence) {
    return null;
  }
  if (non_obvious.length < 3) {
    console.error('[parseHyperInferencePayloadV1] non_obvious_insights must have at least 3 items');
    return null;
  }

  return {
    depth_layer: depth,
    inference_layer: inference,
    prediction_layer: prediction,
    economic_profile: economic,
    taste_profile: taste,
    confidence_matrix: confidence,
    non_obvious_insights: non_obvious,
  };
}

function parseIntentType(x: unknown): IntentType | null {
  if (typeof x !== 'string') return null;
  return (INTENT_TYPES as readonly string[]).includes(x) ? (x as IntentType) : null;
}

function parseIdentityBlock(raw: unknown): HyperInferenceIdentityBlock | null {
  if (!isObj(raw)) return null;
  const archetype = str(raw.archetype);
  const stage = str(raw.stage);
  const confidence = num01(raw.confidence);
  if (!archetype || !stage || confidence === null) return null;
  return { archetype, stage, confidence };
}

function parseDepthV2(raw: unknown): HyperInferenceDepthLayerV2 | null {
  if (!isObj(raw)) return null;
  return {
    core_drivers: strArr(raw.core_drivers),
    behavioral_loops: strArr(raw.behavioral_loops),
    decision_patterns: strArr(raw.decision_patterns),
    attention_patterns: strArr(raw.attention_patterns),
  };
}

function parseInferenceV2(raw: unknown): HyperInferenceInferenceLayerV2 | null {
  if (!isObj(raw)) return null;
  const true_intent = str(raw.true_intent);
  const identity_gap = str(raw.identity_gap);
  if (!true_intent || !identity_gap) return null;
  return {
    true_intent,
    hidden_goals: strArr(raw.hidden_goals),
    frictions: strArr(raw.frictions),
    identity_gap,
    motivations: strArr(raw.motivations),
  };
}

function parsePredictionItemV2(raw: unknown): HyperInferencePredictionItemV2 | null {
  if (!isObj(raw)) return null;
  const action = str(raw.action);
  const timeframe = str(raw.timeframe);
  const p = num01(raw.probability);
  const c = num01(raw.confidence);
  if (!action || !timeframe || p === null || c === null) return null;
  return {
    action,
    probability: p,
    timeframe,
    confidence: c,
    supporting_signals: strArr(raw.supporting_signals, 12),
  };
}

function parseEconomicV2(raw: unknown): HyperInferenceEconomicProfileV2 | null {
  if (!isObj(raw)) return null;
  const spending_style = str(raw.spending_style);
  if (!spending_style) return null;
  return {
    spending_style,
    price_sensitivity: str(raw.price_sensitivity),
    purchase_triggers: strArr(raw.purchase_triggers),
    brand_affinity: strArr(raw.brand_affinity),
  };
}

function parseLifestyleV2(raw: unknown): HyperInferenceLifestyleV2 | null {
  if (!isObj(raw)) return null;
  return {
    brands: strArr(raw.brands),
    fashion: strArr(raw.fashion),
    music: strArr(raw.music),
    media: strArr(raw.media),
    places: strArr(raw.places),
  };
}

function parseConfidenceBySource(raw: unknown): HyperInferenceConfidenceBySource | null {
  if (!isObj(raw)) return null;
  const overall = num01(raw.overall);
  if (overall === null) return null;
  const bs = raw.by_source;
  if (!isObj(bs)) return null;
  const ig = num01(bs.instagram);
  const g = num01(bs.google);
  const yt = num01(bs.youtube);
  const li = num01(bs.linkedin);
  const mu = num01(bs.music);
  if (ig === null || g === null || yt === null || li === null || mu === null) return null;
  return {
    overall,
    by_source: { instagram: ig, google: g, youtube: yt, linkedin: li, music: mu },
  };
}

export function parseHyperInferencePayloadV2(raw: unknown): HyperInferencePayloadV2 | null {
  if (!isObj(raw)) return null;
  const intent_type = parseIntentType(raw.intent_type);
  const identity = parseIdentityBlock(raw.identity);
  const depth = parseDepthV2(raw.depth_layer);
  const inference = parseInferenceV2(raw.inference_layer);
  const economic = parseEconomicV2(raw.economic_profile);
  const lifestyle = parseLifestyleV2(raw.lifestyle);
  const confidence = parseConfidenceBySource(raw.confidence);
  const non_obvious = strArr(raw.non_obvious_insights, 20);

  if (!intent_type || !identity || !depth || !inference || !economic || !lifestyle || !confidence) {
    return null;
  }
  if (non_obvious.length < 2) {
    console.error('[parseHyperInferencePayloadV2] non_obvious_insights must have at least 2 items');
    return null;
  }

  const pl = raw.prediction_layer;
  if (!Array.isArray(pl)) return null;
  const prediction_layer: HyperInferencePredictionItemV2[] = [];
  for (const item of pl) {
    const parsed = parsePredictionItemV2(item);
    if (parsed) prediction_layer.push(parsed);
  }
  if (prediction_layer.length < 1) return null;

  return {
    intent_type,
    identity,
    depth_layer: depth,
    inference_layer: inference,
    prediction_layer,
    economic_profile: economic,
    lifestyle,
    confidence,
    non_obvious_insights: non_obvious,
  };
}

/** Try v2 then v1. */
export function parseHyperInferencePayload(raw: unknown): HyperInferencePayload | HyperInferencePayloadV2 | null {
  const v2 = parseHyperInferencePayloadV2(raw);
  if (v2) return v2;
  return parseHyperInferencePayloadV1(raw);
}

export function parseHyperInferenceWrapper(raw: unknown): HyperInferenceWrapper | null {
  if (!isObj(raw)) return null;
  const generatedAt = str(raw.generatedAt);
  if (!generatedAt) return null;

  if (raw.version === HYPER_INFERENCE_SCHEMA_VERSION_V2) {
    const payload = parseHyperInferencePayloadV2(raw.payload);
    if (!payload) return null;
    return { version: HYPER_INFERENCE_SCHEMA_VERSION_V2, generatedAt, payload };
  }

  if (raw.version === HYPER_INFERENCE_SCHEMA_VERSION_V1) {
    const payload = parseHyperInferencePayloadV1(raw.payload);
    if (!payload) return null;
    return { version: HYPER_INFERENCE_SCHEMA_VERSION_V1, generatedAt, payload };
  }

  return null;
}

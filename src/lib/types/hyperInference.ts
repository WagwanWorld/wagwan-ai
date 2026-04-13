/** Hyper Inference Engine — strict JSON contracts. Safe for client + server. */

import type { IntentType } from '$lib/types/intentWeights';

export const HYPER_INFERENCE_SCHEMA_VERSION_V1 = 1 as const;
export const HYPER_INFERENCE_SCHEMA_VERSION_V2 = 2 as const;

/** @deprecated Use version-specific constants */
export const HYPER_INFERENCE_SCHEMA_VERSION = HYPER_INFERENCE_SCHEMA_VERSION_V1;

export type HyperInferenceSchemaVersion =
  | typeof HYPER_INFERENCE_SCHEMA_VERSION_V1
  | typeof HYPER_INFERENCE_SCHEMA_VERSION_V2;

// ── v1 (legacy persisted graphs) ─────────────────────────────

export interface HyperInferenceDepthLayer {
  core_drivers: string[];
  decision_patterns: string[];
  attention_patterns: string[];
  taste_mechanism: string;
  behavioral_loops: string[];
}

export interface HyperInferenceSelfPerceptionVsReality {
  self_view: string;
  actual_behavior: string;
}

export interface HyperInferenceInferenceLayer {
  true_intent: string;
  hidden_goals: string[];
  motivations: string[];
  frictions: string[];
  identity_gap: string;
  self_perception_vs_reality: HyperInferenceSelfPerceptionVsReality;
}

export interface HyperInferencePredictionLayer {
  next_7_days: string[];
  next_30_days: string[];
  likely_purchases: string[];
  likely_content_consumption: string[];
  likely_behavior_shifts: string[];
}

export interface HyperInferenceEconomicProfile {
  spending_style: string;
  price_sensitivity: string;
  purchase_triggers: string[];
  brand_affinity: string[];
  conversion_probability: Record<string, number>;
}

export interface HyperInferenceTasteProfile {
  aesthetic_bias: string[];
  music_evolution: string[];
  content_bias: string[];
  emerging_interests: string[];
}

export interface HyperInferenceConfidenceMatrix {
  high_confidence: string[];
  medium_confidence: string[];
  low_confidence: string[];
}

/** v1 payload shape */
export interface HyperInferencePayload {
  depth_layer: HyperInferenceDepthLayer;
  inference_layer: HyperInferenceInferenceLayer;
  prediction_layer: HyperInferencePredictionLayer;
  economic_profile: HyperInferenceEconomicProfile;
  taste_profile: HyperInferenceTasteProfile;
  confidence_matrix: HyperInferenceConfidenceMatrix;
  non_obvious_insights: string[];
}

// ── v2 (behavioral intelligence contract) ────────────────────

export interface HyperInferenceIdentityBlock {
  archetype: string;
  stage: string;
  confidence: number;
}

export interface HyperInferenceDepthLayerV2 {
  core_drivers: string[];
  behavioral_loops: string[];
  decision_patterns: string[];
  attention_patterns: string[];
}

export interface HyperInferenceInferenceLayerV2 {
  true_intent: string;
  hidden_goals: string[];
  frictions: string[];
  identity_gap: string;
  motivations: string[];
}

export interface HyperInferencePredictionItemV2 {
  action: string;
  probability: number;
  timeframe: string;
  confidence: number;
  supporting_signals: string[];
}

export interface HyperInferenceEconomicProfileV2 {
  spending_style: string;
  price_sensitivity: string;
  purchase_triggers: string[];
  brand_affinity: string[];
}

export interface HyperInferenceLifestyleV2 {
  brands: string[];
  fashion: string[];
  music: string[];
  media: string[];
  places: string[];
}

export interface HyperInferenceConfidenceBySource {
  overall: number;
  by_source: {
    instagram: number;
    google: number;
    youtube: number;
    linkedin: number;
    music: number;
  };
}

export interface HyperInferencePayloadV2 {
  intent_type: IntentType;
  identity: HyperInferenceIdentityBlock;
  depth_layer: HyperInferenceDepthLayerV2;
  inference_layer: HyperInferenceInferenceLayerV2;
  prediction_layer: HyperInferencePredictionItemV2[];
  economic_profile: HyperInferenceEconomicProfileV2;
  lifestyle: HyperInferenceLifestyleV2;
  confidence: HyperInferenceConfidenceBySource;
  /** At least 2 non-obvious insights */
  non_obvious_insights: string[];
}

export type HyperInferencePayloadUnion = HyperInferencePayload | HyperInferencePayloadV2;

/** Persisted under identity_graph.hyperInference */
export type HyperInferenceWrapper =
  | {
      version: typeof HYPER_INFERENCE_SCHEMA_VERSION_V1;
      generatedAt: string;
      payload: HyperInferencePayload;
    }
  | {
      version: typeof HYPER_INFERENCE_SCHEMA_VERSION_V2;
      generatedAt: string;
      payload: HyperInferencePayloadV2;
    };

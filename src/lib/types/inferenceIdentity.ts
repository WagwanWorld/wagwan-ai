/** Shared types for LLM inference layer (safe for client + server). */

/** Version written by new inference runs (multi-domain). */
export const INFERENCE_SCHEMA_VERSION = 2 as const;

export const INFERENCE_SCHEMA_VERSION_V1 = 1 as const;
export const INFERENCE_SCHEMA_VERSION_V2 = 2 as const;

export type InferenceSchemaVersion =
  | typeof INFERENCE_SCHEMA_VERSION_V1
  | typeof INFERENCE_SCHEMA_VERSION_V2;

export const INFERENCE_HISTORY_CAP = 16;

export const INFERENCE_LIFE_DOMAIN_IDS = [
  'music',
  'shopping_style',
  'career_work',
  'sports_fitness',
  'social_creator',
  'travel_food',
  'wellness',
  'tech_media',
] as const;

export type InferenceLifeDomainId = (typeof INFERENCE_LIFE_DOMAIN_IDS)[number];

export type InferenceEvidenceSource =
  | 'instagram'
  | 'spotify'
  | 'apple_music'
  | 'youtube'
  | 'google'
  | 'linkedin'
  | 'manual'
  | 'inferred_cross';

export interface InferenceEvidenceBullet {
  text: string;
  source: InferenceEvidenceSource;
}

export interface InferenceLifeDomain {
  id: InferenceLifeDomainId;
  label: string;
  confidence: number;
  salience_0_100: number;
  narrative: string;
  evidence: InferenceEvidenceBullet[];
  signals: string[];
  consumption_vs_creation: string;
  likely_next: string[];
}

export interface InferenceIntent {
  primary: string;
  secondary: string[];
  confidence: number;
}

export interface InferenceStage {
  category: string;
  confidence: number;
}

export interface InferenceCreationPatterns {
  frequency: string;
  content_types: string[];
  original_vs_consumption_ratio: string;
}

export interface InferenceEngagementPatterns {
  engages_with: string[];
  interaction_depth: string;
  network_type: string;
}

export interface InferenceTemporalPatterns {
  active_hours: string[];
  consistency: string;
  recent_trend: string;
}

export interface InferenceBehavior {
  creation_patterns: InferenceCreationPatterns;
  engagement_patterns: InferenceEngagementPatterns;
  temporal_patterns: InferenceTemporalPatterns;
}

export interface InferenceInterests {
  explicit: string[];
  latent: string[];
}

export interface InferenceNeeds {
  immediate: string[];
  emerging: string[];
}

export interface InferenceTrajectory {
  direction: string;
  velocity: string;
  stage_shift_signals: string[];
}

export interface InferenceDerivedSignals {
  builder_score: number;
  creator_score: number;
  consumer_score: number;
  momentum_score: number;
  taste_profile: string;
  risk_appetite: string;
}

export interface InferenceContentProfile {
  style: string;
  themes: string[];
  strengths: string[];
  gaps: string[];
}

export interface InferencePredictions {
  likely_next_actions: string[];
  short_term: string[];
  long_term: string[];
}

/** Optional concise predictive layer for UI (model may omit). */
export interface InferencePredictiveRead {
  you_in_one_line: string;
  next_moves: string[];
  commerce_affinity: string[];
}

export interface InferenceIdentityCurrent {
  intent: InferenceIntent;
  stage: InferenceStage;
  behavior: InferenceBehavior;
  interests: InferenceInterests;
  needs: InferenceNeeds;
  trajectory: InferenceTrajectory;
  derived_signals: InferenceDerivedSignals;
  content_profile: InferenceContentProfile;
  predictions: InferencePredictions;
  /** Present for schema v2 snapshots (8 fixed domains). */
  life_domains?: InferenceLifeDomain[];
  /** Short personal forecast + hedged commerce hints (optional). */
  predictive_read?: InferencePredictiveRead;
}

export interface InferenceHistoryEntry {
  inferredAt: string;
  revision: number;
  summaryDelta?: string;
  intentPrimary?: string;
  momentumScore?: number;
}

export interface InferenceIdentityWrapper {
  schemaVersion: InferenceSchemaVersion;
  revision: number;
  inferredAt: string;
  current: InferenceIdentityCurrent;
  history: InferenceHistoryEntry[];
}

/** API-friendly subset for UI (trimmed history). */
export type InferenceIdentityPayload = InferenceIdentityWrapper & {
  history: InferenceHistoryEntry[];
};

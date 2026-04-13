/** Query-shaped context pack for LLMs (map server / Context Builder). */

import type { WeightedSignal } from '$lib/types/signalMeter';

export type QueryIntent =
  | 'action'
  | 'identity'
  | 'growth'
  | 'taste'
  | 'prediction'
  | 'decision'
  | 'exploration';

/** Logical slice ids selected by CONTEXT_MAP (not always top-level identity_graph keys). */
export type ContextSliceId =
  | 'current_state'
  | 'decision_layer'
  | 'recency_signals'
  | 'top_misalignment'
  | 'persona'
  | 'identity_tags'
  | 'archetype'
  | 'vibe'
  | 'behavior_patterns'
  | 'content_profile'
  | 'gaps'
  | 'trajectory'
  | 'lifestyle'
  | 'taste_profile'
  | 'brands'
  | 'music'
  | 'media'
  | 'prediction_layer'
  | 'momentum'
  | 'economic_profile'
  | 'risk_flags'
  | 'opportunity_layer'
  | 'top_signals';

export interface CompressedPersona {
  hero?: string;
  tags?: string[];
  archetype?: string;
}

export interface CompressedState {
  mode?: string;
  focus?: string;
  risk?: string;
  edge?: string;
  one_line?: string;
  pressure?: string;
  momentum?: string;
}

export interface RankedSignalLine {
  type: string;
  value: string;
  score: number;
}

/** Token-efficient payload after compression. */
export interface CompressedContext {
  query: string;
  intent: QueryIntent;
  timestamp: string;
  persona?: CompressedPersona;
  state?: CompressedState;
  signals?: RankedSignalLine[];
  predictions?: string[];
  key_focus?: string | null;
  claims_relevant?: string[];
  /** Which logical slices were requested for this intent. */
  slices_used?: ContextSliceId[];
}

/** Internal: feed for `compressContext`. */
export interface RankedWeightedSignal extends WeightedSignal {
  score: number;
}

export interface CompressionInput {
  query: string;
  intent: QueryIntent;
  timestamp: string;
  sliceIds: ContextSliceId[];
  slices: Record<string, unknown>;
  ranked_signals: RankedWeightedSignal[];
  claims_relevant: string[];
}

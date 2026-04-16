export type IntentType = 'purchase' | 'action' | 'identity' | 'taste' | 'growth';
export type ContextMode = 'morning_professional' | 'weekend_exploration' | 'evening_social' | 'late_night_creative';

export interface BrandQueryIntent {
  // Direct signal targets
  target_genres?: string[];
  target_aesthetics?: string[];
  target_interests?: string[];
  target_brands?: string[];
  target_artists?: string[];
  target_lifestyle?: string[];
  // Intent and behavioral targets
  target_intent_type?: IntentType;
  target_purchase_category?: string;
  target_momentum_min?: number;
  target_creator_tier?: string;
  target_engagement_tier?: string;
  // Demographic targets
  target_cities?: string[];
  target_budget?: ('low' | 'mid' | 'high')[];
  target_career_stage?: string[];
  // Temporal targets
  target_context_mode?: ContextMode;
  target_purchase_window?: string;
  // Match configuration
  min_tier: 1 | 2 | 3 | 4 | 5;
  max_results: number;
  cohort_count: number;
  include_correlations: boolean;
  explain_matches: boolean;
  // Raw for audit
  raw_prompt: string;
  parsed_at: string;
  confidence: number;
}

export interface MatchResult {
  user_google_sub: string;
  match_tier: 1 | 2 | 3 | 4 | 5;
  match_score: number;
  match_confidence: number;
  matched_signals: Array<Record<string, unknown>>;
  correlation_paths?: Array<{
    from: string;
    to: string;
    lift?: number;
    confidence?: number;
    domain_distance?: number;
  }>;
  last_sync_days?: number;
  momentum_score?: number;
  purchase_intent_score?: number;
}

export interface ExpandedSignal {
  value: string;
  category: string;
  weight: number;
  source: 'direct' | 'correlation';
  correlation_from?: string;
  lift?: number;
  confidence?: number;
  domain_distance?: number;
}

export interface WeightedSignal {
  value: string;
  category: string;
  final_score: number;
}

export interface CohortResult {
  cohort_id: string;
  label: string;
  description: string;
  user_count: number;
  avg_match_score: number;
  avg_confidence: number;
  top_signals: WeightedSignal[];
  centroid_vector: number[];
}

export interface MatchedUser {
  user_google_sub: string;
  match_tier: number;
  match_score: number;
  cohort_id: string;
  explanation?: string;
}

export interface SignalCoverage {
  total_signals_searched: number;
  signals_with_matches: string[];
  correlation_expansions_used: number;
}

export interface AudienceMatchResponse {
  query_id: string;
  total_matched: number;
  cohorts: CohortResult[];
  tier_breakdown: Record<number, number>;
  top_users: MatchedUser[];
  signal_coverage: SignalCoverage;
  processing_ms: number;
  correlation_expansions: ExpandedSignal[];
}

export interface LookalikeResult {
  user_google_sub: string;
  similarity_score: number;
  source: 'lookalike';
}

export interface CohortSignalReport {
  coverage: Record<string, number>;
  differentiators: WeightedSignal[];
  total_users: number;
}

export interface CorrelationInsert {
  signal_a: string;
  signal_a_cat: string;
  signal_b: string;
  signal_b_cat: string;
  correlation_r: number;
  support_count: number;
  lift: number;
  confidence: number;
  domain_distance: number;
  source?: string;
}

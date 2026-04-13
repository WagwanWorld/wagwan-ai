/** Structured audience from NL prompt (LLM output). */
export interface ParsedAudience {
  age_range: [number, number] | null;
  location: string | null;
  interests: string[];
  behaviors: string[];
  human_summary: string;
}

export type GraphStrengthLabel = 'high' | 'medium' | 'low';

export interface AudienceSearchUserRow {
  user_google_sub: string;
  name: string;
  city: string;
  match_score: number;
  match_score_breakdown?: {
    interest_match: number;
    behavior_match: number;
    intent_signal: number;
    engagement_probability: number;
  };
  match_reason: string;
  preview_tags: string[];
  /** 0–100 richer identity_graph improves brand match overlap. */
  graph_strength: number;
  graph_strength_label: GraphStrengthLabel;
}

export interface AudienceSearchResult {
  audience_size: number;
  users: AudienceSearchUserRow[];
  key_traits: { tag: string; count: number }[];
  estimated_engagement: string;
  estimated_cost_inr: number | null;
  avg_graph_strength: number;
  /** Share of results with graph_strength >= 65. */
  pct_high_strength_graphs: number;
  rank_strength_boost_applied: boolean;
}

export type CampaignChannels = { email: boolean; in_app: boolean; whatsapp?: boolean };

export interface CampaignTargetInput {
  user_google_sub: string;
  match_score: number;
  match_reason: string;
}

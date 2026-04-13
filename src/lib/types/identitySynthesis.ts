/** Premium identity mirror — persisted under identity_graph.identitySynthesis */

export const IDENTITY_SYNTHESIS_SCHEMA_VERSION = 1 as const;
export const IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2 = 2 as const;

export type ProfessionLevel = 'aspirational' | 'current' | 'adjacent';

export interface IdentitySynthesisProfessionRole {
  title: string;
  why_it_fits: string;
  level: ProfessionLevel;
}

/** Per vertical: short lead + specific items */
export interface IdentitySynthesisShoppingVertical {
  summary: string;
  items: string[];
}

export interface IdentitySynthesisShoppingPreferences {
  fashion: IdentitySynthesisShoppingVertical;
  tech: IdentitySynthesisShoppingVertical;
  lifestyle: IdentitySynthesisShoppingVertical;
  digital_products: IdentitySynthesisShoppingVertical;
}

export interface IdentitySynthesisMoodBoard {
  color_palette: string[];
  textures: string[];
  environments: string[];
  references: string[];
}

export interface IdentitySynthesisTasteProfile {
  music: string;
  cultural_alignment: string;
  content_consumption: string;
}

export interface IdentitySynthesisBehavioralPatterns {
  decision_making: string;
  attention: string;
  social_vs_solo: string;
  risk_appetite: string;
}

export interface IdentitySynthesisTrajectory {
  short_term: string;
  long_term_potential: string;
  hidden_opportunities: string;
}

export interface IdentitySynthesisCoreIdentity {
  archetype: string;
  personality_traits: string[];
  energy: string;
  social_style: string;
}

export interface IdentitySynthesisOptionalExtras {
  people_you_get_along_with?: string[];
  brands_that_match?: string[];
  experiences_youd_love?: string[];
  content_you_should_create?: string[];
}

export interface IdentitySynthesisPayload {
  core_identity: IdentitySynthesisCoreIdentity;
  suggested_professions: IdentitySynthesisProfessionRole[];
  shopping_preferences: IdentitySynthesisShoppingPreferences;
  mood_board: IdentitySynthesisMoodBoard;
  taste_profile: IdentitySynthesisTasteProfile;
  behavioral_patterns: IdentitySynthesisBehavioralPatterns;
  trajectory: IdentitySynthesisTrajectory;
  hidden_signals_and_contradictions: string[];
  immediate_suggestions: string[];
  optional?: IdentitySynthesisOptionalExtras;
}

export interface IdentitySynthesisWrapperV1 {
  version: typeof IDENTITY_SYNTHESIS_SCHEMA_VERSION;
  generatedAt: string;
  payload: IdentitySynthesisPayload;
}

// ── v2 multi-agent synthesis ───────────────────────────────────────────────

export type IdentitySynthesisActivationAgentId =
  | 'fashion'
  | 'commerce'
  | 'moodboard'
  | 'taste_culture'
  | 'professional'
  | 'behavioral';

export interface IdentitySynthesisActivation {
  primary_agents: IdentitySynthesisActivationAgentId[];
  user_query_echo?: string;
  rationale: string;
}

export interface IdentitySynthesisFashionStyleBreakdown {
  silhouettes: string[];
  color_tendencies: string[];
  materials: string[];
  fit_preferences: string[];
}

export interface IdentitySynthesisFashionBrandAffinity {
  brand: string;
  tier: 'luxury' | 'mid' | 'accessible';
  reason: string;
}

export interface IdentitySynthesisFashionProductSuggestion {
  item: string;
  brand: string;
  why: string;
}

export interface IdentitySynthesisFashionAgent {
  style_archetype: string;
  style_breakdown: IdentitySynthesisFashionStyleBreakdown;
  brand_affinity: IdentitySynthesisFashionBrandAffinity[];
  product_suggestions: IdentitySynthesisFashionProductSuggestion[];
  avoid_patterns: string[];
  image_queries: string[];
  confidence: string;
}

export interface IdentitySynthesisCommercePurchaseBehavior {
  price_sensitivity: string;
  triggers: string[];
  frequency: string;
}

export interface IdentitySynthesisCommerceProductRec {
  product: string;
  brand: string;
  price_range: string;
  reason: string;
}

export interface IdentitySynthesisCommerceAgent {
  high_intent_categories: string[];
  aspirational_categories: string[];
  purchase_behavior: IdentitySynthesisCommercePurchaseBehavior;
  product_recommendations: IdentitySynthesisCommerceProductRec[];
  brand_affinity_map: string[];
  image_queries: string[];
  confidence: string;
}

export interface IdentitySynthesisMoodboardColorSwatch {
  name: string;
  hex: string;
}

export interface IdentitySynthesisMoodboardAgent {
  aesthetic_archetype: string;
  visual_themes: string[];
  color_palette: IdentitySynthesisMoodboardColorSwatch[];
  textures: string[];
  environments: string[];
  design_references: string[];
  image_queries: string[];
  confidence: string;
}

export interface IdentitySynthesisTasteCultureAgent {
  taste_archetype: string;
  genre_clusters: string[];
  emotional_profile: string[];
  cultural_positioning: string;
  artist_affinities: string[];
  content_preferences: string[];
  image_queries: string[];
  confidence: string;
}

export interface IdentitySynthesisProfessionalRoleSuggestion {
  role: string;
  type: ProfessionLevel;
  reason: string;
}

export interface IdentitySynthesisProfessionalAgent {
  current_signal: string;
  skill_graph: string[];
  suggested_roles: IdentitySynthesisProfessionalRoleSuggestion[];
  trajectory_direction: string;
  opportunity_gaps: string[];
  learning_recommendations: string[];
  confidence: string;
}

export interface IdentitySynthesisBehavioralAgent {
  decision_style: string;
  attention_pattern: string;
  risk_profile: string;
  social_orientation: string;
  behavioral_traits: string[];
  contradictions: string[];
  confidence: string;
}

export interface IdentitySynthesisBrainAgent {
  core_identity: string;
  top_traits: string[];
  dominant_signals: string[];
  conflicts: string[];
  resolved_identity: string;
  what_we_know_about_you: Record<string, string>;
  confidence: string;
}

export interface IdentitySynthesisPayloadV2 {
  activation: IdentitySynthesisActivation;
  fashion: IdentitySynthesisFashionAgent;
  commerce: IdentitySynthesisCommerceAgent;
  moodboard: IdentitySynthesisMoodboardAgent;
  taste_culture: IdentitySynthesisTasteCultureAgent;
  professional: IdentitySynthesisProfessionalAgent;
  behavioral: IdentitySynthesisBehavioralAgent;
  synthesis: IdentitySynthesisBrainAgent;
}

export interface IdentitySynthesisWrapperV2 {
  version: typeof IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2;
  generatedAt: string;
  payload: IdentitySynthesisPayloadV2;
}

/** Persisted graph value: v1 mirror or v2 multi-agent — narrow on `version` */
export type IdentitySynthesisWrapper = IdentitySynthesisWrapperV1 | IdentitySynthesisWrapperV2;

/** @alias */
export type IdentitySynthesisStored = IdentitySynthesisWrapper;

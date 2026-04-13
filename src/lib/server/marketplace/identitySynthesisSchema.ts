/**
 * Runtime parse for identity_graph.identitySynthesis (server).
 */

import {
  IDENTITY_SYNTHESIS_SCHEMA_VERSION,
  IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2,
  type IdentitySynthesisActivation,
  type IdentitySynthesisActivationAgentId,
  type IdentitySynthesisBehavioralAgent,
  type IdentitySynthesisBehavioralPatterns,
  type IdentitySynthesisBrainAgent,
  type IdentitySynthesisCommerceAgent,
  type IdentitySynthesisCoreIdentity,
  type IdentitySynthesisFashionAgent,
  type IdentitySynthesisMoodBoard,
  type IdentitySynthesisMoodboardAgent,
  type IdentitySynthesisOptionalExtras,
  type IdentitySynthesisPayload,
  type IdentitySynthesisPayloadV2,
  type IdentitySynthesisProfessionalAgent,
  type IdentitySynthesisProfessionRole,
  type IdentitySynthesisShoppingPreferences,
  type IdentitySynthesisShoppingVertical,
  type IdentitySynthesisTasteCultureAgent,
  type IdentitySynthesisTasteProfile,
  type IdentitySynthesisTrajectory,
  type IdentitySynthesisWrapper,
  type IdentitySynthesisWrapperV1,
  type IdentitySynthesisWrapperV2,
  type ProfessionLevel,
} from '$lib/types/identitySynthesis';

const MAX_LINE = 1200;
const MAX_ITEMS = 12;
const MAX_TRAITS = 8;
const MAX_PROFESSIONS = 6;
const MAX_TENSIONS = 8;
const MAX_SUGGESTIONS = 5;
const MAX_OPTIONAL_LIST = 10;

const MAX_V2_LINE = 1400;
const MAX_V2_LIST = 20;
const MAX_V2_IMAGE_QUERIES = 14;
const MAX_KNOW_KEYS = 24;

const ACTIVATION_AGENT_IDS = new Set<IdentitySynthesisActivationAgentId>([
  'fashion',
  'commerce',
  'moodboard',
  'taste_culture',
  'professional',
  'behavioral',
]);

const BRAND_TIERS = new Set(['luxury', 'mid', 'accessible']);

const LEVELS = new Set<ProfessionLevel>(['aspirational', 'current', 'adjacent']);

function lineV2(x: unknown, max = MAX_V2_LINE): string {
  if (typeof x !== 'string') return '';
  const t = x.replace(/\s+/g, ' ').trim();
  if (t.length > max) return `${t.slice(0, max - 1)}…`;
  return t;
}

function strArrV2(x: unknown, maxLen: number, maxEach = 500): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((t): t is string => typeof t === 'string')
    .map(t => lineV2(t, maxEach))
    .filter(Boolean)
    .slice(0, maxLen);
}

function parseHex(x: unknown): string {
  const s = typeof x === 'string' ? x.trim() : '';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  return '';
}

function parseActivation(raw: unknown): IdentitySynthesisActivation {
  if (!isObj(raw)) {
    return { primary_agents: [], rationale: 'Baseline signal-weighted read.' };
  }
  const rationale = lineV2(raw.rationale, 800);
  const user_query_echo = raw.user_query_echo !== undefined ? lineV2(raw.user_query_echo, 800) : undefined;
  const pa = Array.isArray(raw.primary_agents) ? raw.primary_agents : [];
  const primary_agents: IdentitySynthesisActivationAgentId[] = [];
  for (const a of pa) {
    if (typeof a !== 'string') continue;
    const id = a.trim() as IdentitySynthesisActivationAgentId;
    if (ACTIVATION_AGENT_IDS.has(id) && !primary_agents.includes(id)) primary_agents.push(id);
    if (primary_agents.length >= 6) break;
  }
  return { primary_agents, ...(user_query_echo ? { user_query_echo } : {}), rationale: rationale || 'Baseline signal-weighted read.' };
}

function parseFashion(raw: unknown): IdentitySynthesisFashionAgent | null {
  if (!isObj(raw)) return null;
  const style_archetype = lineV2(raw.style_archetype, 400);
  const conf = lineV2(raw.confidence, 120);
  if (!style_archetype || !conf) return null;
  const sb = isObj(raw.style_breakdown) ? raw.style_breakdown : {};
  const style_breakdown = {
    silhouettes: strArrV2(sb.silhouettes, 12),
    color_tendencies: strArrV2(sb.color_tendencies, 12),
    materials: strArrV2(sb.materials, 12),
    fit_preferences: strArrV2(sb.fit_preferences, 12),
  };
  const brand_affinity: IdentitySynthesisFashionAgent['brand_affinity'] = [];
  if (Array.isArray(raw.brand_affinity)) {
    for (const b of raw.brand_affinity) {
      if (!isObj(b)) continue;
      const brand = lineV2(b.brand, 120);
      const reason = lineV2(b.reason, 400);
      const tr = typeof b.tier === 'string' ? b.tier.trim() : '';
      const tier = BRAND_TIERS.has(tr) ? (tr as 'luxury' | 'mid' | 'accessible') : 'mid';
      if (brand && reason) brand_affinity.push({ brand, tier, reason });
      if (brand_affinity.length >= 12) break;
    }
  }
  const product_suggestions: IdentitySynthesisFashionAgent['product_suggestions'] = [];
  if (Array.isArray(raw.product_suggestions)) {
    for (const p of raw.product_suggestions) {
      if (!isObj(p)) continue;
      const item = lineV2(p.item, 200);
      const brand = lineV2(p.brand, 120);
      const why = lineV2(p.why, 400);
      if (item && why) product_suggestions.push({ item, brand: brand || '—', why });
      if (product_suggestions.length >= 12) break;
    }
  }
  const avoid_patterns = strArrV2(raw.avoid_patterns, 12);
  const image_queries = strArrV2(raw.image_queries, MAX_V2_IMAGE_QUERIES, 200);
  if (image_queries.length < 4) return null;
  return {
    style_archetype,
    style_breakdown,
    brand_affinity,
    product_suggestions,
    avoid_patterns,
    image_queries,
    confidence: conf,
  };
}

function parseCommerce(raw: unknown): IdentitySynthesisCommerceAgent | null {
  if (!isObj(raw)) return null;
  const conf = lineV2(raw.confidence, 120);
  if (!conf) return null;
  const pb = isObj(raw.purchase_behavior) ? raw.purchase_behavior : {};
  const purchase_behavior = {
    price_sensitivity: lineV2(pb.price_sensitivity, 400) || 'unknown',
    triggers: strArrV2(pb.triggers, 12),
    frequency: lineV2(pb.frequency, 400) || 'unknown',
  };
  const product_recommendations: IdentitySynthesisCommerceAgent['product_recommendations'] = [];
  if (Array.isArray(raw.product_recommendations)) {
    for (const p of raw.product_recommendations) {
      if (!isObj(p)) continue;
      const product = lineV2(p.product, 200);
      const brand = lineV2(p.brand, 120);
      const price_range = lineV2(p.price_range, 120);
      const reason = lineV2(p.reason, 400);
      if (product && reason) product_recommendations.push({ product, brand: brand || '—', price_range: price_range || '—', reason });
      if (product_recommendations.length >= 12) break;
    }
  }
  const image_queries = strArrV2(raw.image_queries, MAX_V2_IMAGE_QUERIES, 200);
  if (image_queries.length < 2) return null;
  return {
    high_intent_categories: strArrV2(raw.high_intent_categories, MAX_V2_LIST),
    aspirational_categories: strArrV2(raw.aspirational_categories, MAX_V2_LIST),
    purchase_behavior,
    product_recommendations,
    brand_affinity_map: strArrV2(raw.brand_affinity_map, 16),
    image_queries,
    confidence: conf,
  };
}

function parseMoodboardV2(raw: unknown): IdentitySynthesisMoodboardAgent | null {
  if (!isObj(raw)) return null;
  const aesthetic_archetype = lineV2(raw.aesthetic_archetype, 400);
  const conf = lineV2(raw.confidence, 120);
  if (!aesthetic_archetype || !conf) return null;
  const color_palette: IdentitySynthesisMoodboardAgent['color_palette'] = [];
  if (Array.isArray(raw.color_palette)) {
    for (const c of raw.color_palette) {
      if (!isObj(c)) continue;
      const name = lineV2(c.name, 80);
      const hex = parseHex(c.hex);
      if (name && hex) color_palette.push({ name, hex });
      if (color_palette.length >= 16) break;
    }
  }
  if (color_palette.length < 2) return null;
  const image_queries = strArrV2(raw.image_queries, MAX_V2_IMAGE_QUERIES, 200);
  if (image_queries.length < 2) return null;
  return {
    aesthetic_archetype,
    visual_themes: strArrV2(raw.visual_themes, 14),
    color_palette,
    textures: strArrV2(raw.textures, 14),
    environments: strArrV2(raw.environments, 12),
    design_references: strArrV2(raw.design_references, 14),
    image_queries,
    confidence: conf,
  };
}

function parseTasteCulture(raw: unknown): IdentitySynthesisTasteCultureAgent | null {
  if (!isObj(raw)) return null;
  const taste_archetype = lineV2(raw.taste_archetype, 400);
  const cultural_positioning = lineV2(raw.cultural_positioning, MAX_V2_LINE);
  const conf = lineV2(raw.confidence, 120);
  if (!taste_archetype || !cultural_positioning || !conf) return null;
  const image_queries = strArrV2(raw.image_queries, MAX_V2_IMAGE_QUERIES, 200);
  if (image_queries.length < 2) return null;
  return {
    taste_archetype,
    genre_clusters: strArrV2(raw.genre_clusters, 14),
    emotional_profile: strArrV2(raw.emotional_profile, 12),
    cultural_positioning,
    artist_affinities: strArrV2(raw.artist_affinities, 16),
    content_preferences: strArrV2(raw.content_preferences, 14),
    image_queries,
    confidence: conf,
  };
}

function parseProfessionalV2(raw: unknown): IdentitySynthesisProfessionalAgent | null {
  if (!isObj(raw)) return null;
  const current_signal = lineV2(raw.current_signal, MAX_V2_LINE);
  const trajectory_direction = lineV2(raw.trajectory_direction, MAX_V2_LINE);
  const conf = lineV2(raw.confidence, 120);
  if (!current_signal || !trajectory_direction || !conf) return null;
  const suggested_roles: IdentitySynthesisProfessionalAgent['suggested_roles'] = [];
  if (Array.isArray(raw.suggested_roles)) {
    for (const r of raw.suggested_roles) {
      if (!isObj(r)) continue;
      const role = lineV2(r.role, 200);
      const reason = lineV2(r.reason, 500);
      const lv = typeof r.type === 'string' ? r.type.trim() : '';
      const type =
        typeof lv === 'string' && LEVELS.has(lv as ProfessionLevel) ? (lv as ProfessionLevel) : 'adjacent';
      if (role && reason) suggested_roles.push({ role, type, reason });
      if (suggested_roles.length >= 8) break;
    }
  }
  if (suggested_roles.length < 1) return null;
  return {
    current_signal,
    skill_graph: strArrV2(raw.skill_graph, 20),
    suggested_roles,
    trajectory_direction,
    opportunity_gaps: strArrV2(raw.opportunity_gaps, 12),
    learning_recommendations: strArrV2(raw.learning_recommendations, 12),
    confidence: conf,
  };
}

function parseBehavioralV2(raw: unknown): IdentitySynthesisBehavioralAgent | null {
  if (!isObj(raw)) return null;
  const decision_style = lineV2(raw.decision_style, MAX_V2_LINE);
  const attention_pattern = lineV2(raw.attention_pattern, MAX_V2_LINE);
  const risk_profile = lineV2(raw.risk_profile, 600);
  const social_orientation = lineV2(raw.social_orientation, 600);
  const conf = lineV2(raw.confidence, 120);
  if (!decision_style || !attention_pattern || !risk_profile || !social_orientation || !conf) return null;
  const contradictions = strArrV2(raw.contradictions, 10);
  if (contradictions.length < 1) return null;
  return {
    decision_style,
    attention_pattern,
    risk_profile,
    social_orientation,
    behavioral_traits: strArrV2(raw.behavioral_traits, 14),
    contradictions,
    confidence: conf,
  };
}

function parseKnowAbout(raw: unknown): Record<string, string> {
  if (!isObj(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== 'string' || k.length > 160) continue;
    if (typeof v !== 'string') continue;
    const t = lineV2(v, 500);
    if (t) out[k.trim()] = t;
    if (Object.keys(out).length >= MAX_KNOW_KEYS) break;
  }
  return out;
}

function parseSynthesisBrain(raw: unknown): IdentitySynthesisBrainAgent | null {
  if (!isObj(raw)) return null;
  const core_identity = lineV2(raw.core_identity, 600);
  const resolved_identity = lineV2(raw.resolved_identity, MAX_V2_LINE);
  const conf = lineV2(raw.confidence, 120);
  if (!core_identity || !resolved_identity || !conf) return null;
  const what_you_know = parseKnowAbout(raw.what_we_know_about_you);
  return {
    core_identity,
    top_traits: strArrV2(raw.top_traits, MAX_TRAITS),
    dominant_signals: strArrV2(raw.dominant_signals, 14),
    conflicts: strArrV2(raw.conflicts, 10),
    resolved_identity,
    what_we_know_about_you: what_you_know,
    confidence: conf,
  };
}

export function parseIdentitySynthesisPayloadV2(raw: unknown): IdentitySynthesisPayloadV2 | null {
  if (!isObj(raw)) return null;

  const activation = parseActivation(raw.activation);

  const fashion = parseFashion(raw.fashion);
  const commerce = parseCommerce(raw.commerce);
  const moodboard = parseMoodboardV2(raw.moodboard);
  const taste_culture = parseTasteCulture(raw.taste_culture);
  const professional = parseProfessionalV2(raw.professional);
  const behavioral = parseBehavioralV2(raw.behavioral);
  const synthesis = parseSynthesisBrain(raw.synthesis);

  if (!fashion || !commerce || !moodboard || !taste_culture || !professional || !behavioral || !synthesis) {
    return null;
  }

  return {
    activation,
    fashion,
    commerce,
    moodboard,
    taste_culture,
    professional,
    behavioral,
    synthesis,
  };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function line(x: unknown, max = MAX_LINE): string {
  if (typeof x !== 'string') return '';
  const t = x.replace(/\s+/g, ' ').trim();
  if (t.length > max) return `${t.slice(0, max - 1)}…`;
  return t;
}

function strArr(x: unknown, maxLen: number, maxEach = 400): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((t): t is string => typeof t === 'string')
    .map(t => line(t, maxEach))
    .filter(Boolean)
    .slice(0, maxLen);
}

function parseProfessionRole(raw: unknown): IdentitySynthesisProfessionRole | null {
  if (!isObj(raw)) return null;
  const title = line(raw.title, 200);
  const why_it_fits = line(raw.why_it_fits, 500);
  const lv = raw.level;
  const level =
    typeof lv === 'string' && LEVELS.has(lv as ProfessionLevel) ? (lv as ProfessionLevel) : null;
  if (!title || !why_it_fits || !level) return null;
  return { title, why_it_fits, level };
}

function parseShoppingVertical(raw: unknown): IdentitySynthesisShoppingVertical {
  if (!isObj(raw)) return { summary: '', items: [] };
  return {
    summary: line(raw.summary, 400),
    items: strArr(raw.items, MAX_ITEMS, 200),
  };
}

function parseShoppingPreferences(raw: unknown): IdentitySynthesisShoppingPreferences {
  if (!isObj(raw)) {
    const empty = (): IdentitySynthesisShoppingVertical => ({ summary: '', items: [] });
    return {
      fashion: empty(),
      tech: empty(),
      lifestyle: empty(),
      digital_products: empty(),
    };
  }
  return {
    fashion: parseShoppingVertical(raw.fashion),
    tech: parseShoppingVertical(raw.tech),
    lifestyle: parseShoppingVertical(raw.lifestyle),
    digital_products: parseShoppingVertical(raw.digital_products ?? raw.digital),
  };
}

function parseMoodBoard(raw: unknown): IdentitySynthesisMoodBoard {
  if (!isObj(raw)) {
    return { color_palette: [], textures: [], environments: [], references: [] };
  }
  return {
    color_palette: strArr(raw.color_palette, 16, 120),
    textures: strArr(raw.textures, 16, 120),
    environments: strArr(raw.environments, 12, 200),
    references: strArr(raw.references, 16, 200),
  };
}

function parseTaste(raw: unknown): IdentitySynthesisTasteProfile {
  if (!isObj(raw)) return { music: '', cultural_alignment: '', content_consumption: '' };
  return {
    music: line(raw.music, MAX_LINE),
    cultural_alignment: line(raw.cultural_alignment, MAX_LINE),
    content_consumption: line(raw.content_consumption, MAX_LINE),
  };
}

function parseBehavioral(raw: unknown): IdentitySynthesisBehavioralPatterns {
  if (!isObj(raw)) {
    return { decision_making: '', attention: '', social_vs_solo: '', risk_appetite: '' };
  }
  return {
    decision_making: line(raw.decision_making, MAX_LINE),
    attention: line(raw.attention, MAX_LINE),
    social_vs_solo: line(raw.social_vs_solo, MAX_LINE),
    risk_appetite: line(raw.risk_appetite, MAX_LINE),
  };
}

function parseTrajectory(raw: unknown): IdentitySynthesisTrajectory {
  if (!isObj(raw)) {
    return { short_term: '', long_term_potential: '', hidden_opportunities: '' };
  }
  return {
    short_term: line(raw.short_term, MAX_LINE),
    long_term_potential: line(raw.long_term_potential, MAX_LINE),
    hidden_opportunities: line(raw.hidden_opportunities, MAX_LINE),
  };
}

function parseCoreIdentity(raw: unknown): IdentitySynthesisCoreIdentity | null {
  if (!isObj(raw)) return null;
  const archetype = line(raw.archetype, 240);
  const personality_traits = strArr(raw.personality_traits, MAX_TRAITS, 160);
  const energy = line(raw.energy, 400);
  const social_style = line(raw.social_style, 400);
  if (!archetype || !personality_traits.length || !energy || !social_style) return null;
  return { archetype, personality_traits, energy, social_style };
}

function parseOptional(raw: unknown): IdentitySynthesisOptionalExtras | undefined {
  if (!isObj(raw)) return undefined;
  const people_you_get_along_with = strArr(raw.people_you_get_along_with, MAX_OPTIONAL_LIST);
  const brands_that_match = strArr(raw.brands_that_match, MAX_OPTIONAL_LIST);
  const experiences_youd_love = strArr(raw.experiences_youd_love, MAX_OPTIONAL_LIST);
  const content_you_should_create = strArr(raw.content_you_should_create, MAX_OPTIONAL_LIST);
  if (
    !people_you_get_along_with.length &&
    !brands_that_match.length &&
    !experiences_youd_love.length &&
    !content_you_should_create.length
  ) {
    return undefined;
  }
  return {
    ...(people_you_get_along_with.length ? { people_you_get_along_with } : {}),
    ...(brands_that_match.length ? { brands_that_match } : {}),
    ...(experiences_youd_love.length ? { experiences_youd_love } : {}),
    ...(content_you_should_create.length ? { content_you_should_create } : {}),
  };
}

export function parseIdentitySynthesisPayload(raw: unknown): IdentitySynthesisPayload | null {
  if (!isObj(raw)) return null;

  const core_identity = parseCoreIdentity(raw.core_identity);
  if (!core_identity) return null;

  const profIn = Array.isArray(raw.suggested_professions) ? raw.suggested_professions : [];
  const suggested_professions: IdentitySynthesisProfessionRole[] = [];
  for (const p of profIn) {
    const pr = parseProfessionRole(p);
    if (pr) suggested_professions.push(pr);
  }
  if (suggested_professions.length < 1) return null;

  const shopping_preferences = parseShoppingPreferences(raw.shopping_preferences);
  const mood_board = parseMoodBoard(raw.mood_board);
  const taste_profile = parseTaste(raw.taste_profile);
  const behavioral_patterns = parseBehavioral(raw.behavioral_patterns);
  const trajectory = parseTrajectory(raw.trajectory);

  const tensionsIn = Array.isArray(raw.hidden_signals_and_contradictions)
    ? raw.hidden_signals_and_contradictions
    : [];
  const hidden_signals_and_contradictions = tensionsIn
    .filter((t): t is string => typeof t === 'string')
    .map(t => line(t, 500))
    .filter(Boolean)
    .slice(0, MAX_TENSIONS);

  const suggIn = Array.isArray(raw.immediate_suggestions) ? raw.immediate_suggestions : [];
  const immediate_suggestions = suggIn
    .filter((t): t is string => typeof t === 'string')
    .map(t => line(t, 400))
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS);

  if (!hidden_signals_and_contradictions.length || immediate_suggestions.length < 1) return null;

  const optional = parseOptional(raw.optional);

  return {
    core_identity,
    suggested_professions: suggested_professions.slice(0, MAX_PROFESSIONS),
    shopping_preferences,
    mood_board,
    taste_profile,
    behavioral_patterns,
    trajectory,
    hidden_signals_and_contradictions,
    immediate_suggestions,
    ...(optional ? { optional } : {}),
  };
}

export function parseIdentitySynthesisWrapper(raw: unknown): IdentitySynthesisWrapper | null {
  if (!isObj(raw)) return null;
  const generatedAt = typeof raw.generatedAt === 'string' ? raw.generatedAt.trim() : '';
  if (!generatedAt) return null;
  const ver = raw.version;

  if (ver === IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2 || ver === 2) {
    const payload = parseIdentitySynthesisPayloadV2(raw.payload);
    if (!payload) return null;
    const out: IdentitySynthesisWrapperV2 = {
      version: IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2,
      generatedAt,
      payload,
    };
    return out;
  }

  if (ver === IDENTITY_SYNTHESIS_SCHEMA_VERSION || ver === 1 || ver === undefined) {
    const payload = parseIdentitySynthesisPayload(raw.payload);
    if (!payload) return null;
    const out: IdentitySynthesisWrapperV1 = {
      version: IDENTITY_SYNTHESIS_SCHEMA_VERSION,
      generatedAt,
      payload,
    };
    return out;
  }

  return null;
}

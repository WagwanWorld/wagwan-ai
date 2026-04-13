import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import {
  IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2,
  type IdentitySynthesisWrapperV2,
} from '$lib/types/identitySynthesis';
import { buildIdentityIntelligenceBundle } from './inferIdentityIntelligence';
import { parseIdentitySynthesisPayloadV2 } from './identitySynthesisSchema';

const MODEL = 'claude-haiku-4-5-20251001';

function stripJsonFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripJsonFence(text);
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

function snipJson(value: unknown, max: number): unknown {
  if (value === undefined) return null;
  try {
    const s = JSON.stringify(value);
    if (typeof s !== 'string') return null;
    if (s.length <= max) return value;
    return { _truncated: true, preview: `${s.slice(0, max - 20)}…` };
  } catch {
    return null;
  }
}

/** Bundle graph + persisted LLM layers for identity mirror synthesis. */
export function buildIdentitySynthesisBundle(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  recencyContext: string;
  identitySnapshot: unknown | null;
  identityIntelligence: unknown | null;
  hyperInference: unknown | null;
  signalMeter: unknown | null;
  memoryGraph: unknown | null;
  userQuery?: string | undefined;
}): string {
  const baseJson = buildIdentityIntelligenceBundle(
    params.graph,
    params.identitySummary,
    params.inferenceCurrent,
    params.recencyContext,
  );
  const base = JSON.parse(baseJson) as Record<string, unknown>;
  const bundle: Record<string, unknown> = {
    ...base,
    synthesis_context: {
      identity_snapshot: snipJson(params.identitySnapshot, 14_000),
      identity_intelligence: snipJson(params.identityIntelligence, 12_000),
      hyper_inference: snipJson(params.hyperInference, 14_000),
      signal_meter: snipJson(params.signalMeter, 8000),
      memory_graph: snipJson(params.memoryGraph, 8000),
    },
  };
  if (params.userQuery?.trim()) {
    bundle.user_query = params.userQuery.trim();
  }
  let out = JSON.stringify(bundle);
  if (out.length > 28_000) {
    out = out.slice(0, 28_000) + '…';
  }
  return out;
}

const SYSTEM_PROMPT = `SYSTEM ROLE — Specialized identity intelligence agent
You analyze user signals and produce highly specific, non-generic insights.
Rules:
- Avoid vague language; prefer specificity over generic safety.
- Use real-world references (named brands, products, environments) when grounded in input.
- Include confidence fields as short human-readable strings (e.g. basis + uncertainty), not boilerplate.
- If uncertain: narrow the claim, lower confidence, never pad with generic traits.
- Do not say "minimalist" without qualifying (e.g. clean corporate minimal vs editorial minimal).

Signal weights when resolving conflicts (do not average blindly):
- Music/audio = emotional + identity; Instagram = aesthetic + social; LinkedIn = professional;
- Google/YouTube = curiosity + intent; user_query in INPUT (if present) = highest-priority lens for ACTIVATION.

## Query-driven ACTIVATION
The INPUT JSON may include "user_query" (string). If present:
- Infer which domain agent(s) the question targets. Examples: career → professional; purchase/buy/budget → commerce (+ fashion if wardrobe); vibe/colors/aesthetic → moodboard; music/artists → taste_culture; habits/why do I / patterns → behavioral + synthesis.
- Fill "activation": primary_agents (subset of: fashion, commerce, moodboard, taste_culture, professional, behavioral), user_query_echo (short echo of their question), rationale (one sentence why those agents).
- Give ACTIVATED agents richer, query-grounded detail and more image_queries; keep other agents complete but slightly leaner if needed.
If user_query is absent: primary_agents may be empty; rationale = baseline signal-weighted read; all agents still produce full sections from signals.

## Output
Return ONLY one JSON object (no markdown). Root keys MUST match exactly this structure:

{
  "activation": {
    "primary_agents": [],
    "user_query_echo": "",
    "rationale": ""
  },
  "fashion": {
    "style_archetype": "",
    "style_breakdown": { "silhouettes": [], "color_tendencies": [], "materials": [], "fit_preferences": [] },
    "brand_affinity": [ { "brand": "", "tier": "luxury|mid|accessible", "reason": "" } ],
    "product_suggestions": [ { "item": "", "brand": "", "why": "" } ],
    "avoid_patterns": [],
    "image_queries": [],
    "confidence": ""
  },
  "commerce": {
    "high_intent_categories": [],
    "aspirational_categories": [],
    "purchase_behavior": { "price_sensitivity": "", "triggers": [], "frequency": "" },
    "product_recommendations": [ { "product": "", "brand": "", "price_range": "", "reason": "" } ],
    "brand_affinity_map": [],
    "image_queries": [],
    "confidence": ""
  },
  "moodboard": {
    "aesthetic_archetype": "",
    "visual_themes": [],
    "color_palette": [ { "name": "", "hex": "#RRGGBB" } ],
    "textures": [],
    "environments": [],
    "design_references": [],
    "image_queries": [],
    "confidence": ""
  },
  "taste_culture": {
    "taste_archetype": "",
    "genre_clusters": [],
    "emotional_profile": [],
    "cultural_positioning": "",
    "artist_affinities": [],
    "content_preferences": [],
    "image_queries": [],
    "confidence": ""
  },
  "professional": {
    "current_signal": "",
    "skill_graph": [],
    "suggested_roles": [ { "role": "", "type": "aspirational|current|adjacent", "reason": "" } ],
    "trajectory_direction": "",
    "opportunity_gaps": [],
    "learning_recommendations": [],
    "confidence": ""
  },
  "behavioral": {
    "decision_style": "",
    "attention_pattern": "",
    "risk_profile": "",
    "social_orientation": "",
    "behavioral_traits": [],
    "contradictions": [],
    "confidence": ""
  },
  "synthesis": {
    "core_identity": "",
    "top_traits": [],
    "dominant_signals": [],
    "conflicts": [],
    "resolved_identity": "",
    "what_we_know_about_you": {},
    "confidence": ""
  }
}

Hard requirements:
- fashion.image_queries: at least 6 distinct search-style strings for UI imagery.
- moodboard.color_palette: at least 4 entries; every hex must be valid #RGB or #RRGGBB.
- behavioral.contradictions: at least 1 non-generic tension grounded in signals.
- synthesis: resolve conflicts using recency + consistency; list conflicts explicitly; do not average incompatible signals into mush.
- commerce: separate what they admire vs what they are likely to buy; be honest about price sensitivity.
- taste_culture: interpret meaning (early adopter vs mainstream vs niche) not genre lists alone.
- professional: suggested roles must map to observed skills/interests; no fantasy titles.`;

export async function inferIdentitySynthesisFromBundle(
  bundleJson: string,
  opts?: { userQuery?: string },
): Promise<IdentitySynthesisWrapperV2 | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 180_000 });

  const uq = opts?.userQuery?.trim();
  const userMessage = `INPUT (JSON) below. Produce the multi-agent identity synthesis (v2). Return ONLY valid JSON matching the system contract.

${uq ? `IMPORTANT: The user asked: """${uq}"""\nFollow ACTIVATION rules for this question.\n\n` : ''}${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16_384,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    const payload = parseIdentitySynthesisPayloadV2(raw);
    if (!payload) {
      console.error('[inferIdentitySynthesis] v2 parse failed, sample:', String(text).slice(0, 500));
      return null;
    }
    return {
      version: IDENTITY_SYNTHESIS_SCHEMA_VERSION_V2,
      generatedAt: new Date().toISOString(),
      payload,
    };
  } catch (e) {
    console.error('[inferIdentitySynthesis]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runIdentitySynthesisFromInputs(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  recencyContext: string;
  identitySnapshot: unknown | null;
  identityIntelligence: unknown | null;
  hyperInference: unknown | null;
  signalMeter: unknown | null;
  memoryGraph: unknown | null;
  userQuery?: string | undefined;
}): Promise<IdentitySynthesisWrapperV2 | null> {
  const bundle = buildIdentitySynthesisBundle(params);
  return inferIdentitySynthesisFromBundle(bundle, { userQuery: params.userQuery });
}

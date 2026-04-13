import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import { IDENTITY_INTELLIGENCE_SCHEMA_VERSION, type IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
import { parseIdentityIntelligencePayload } from './identityIntelligenceSchema';

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

function snip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function compactInference(current: InferenceIdentityCurrent | null): Record<string, unknown> | null {
  if (!current) return null;
  const domains = [...(current.life_domains ?? [])].sort((a, b) => b.salience_0_100 - a.salience_0_100);
  return {
    intent_primary: snip(current.intent.primary, 400),
    stage: snip(current.stage.category, 120),
    predictive_read: current.predictive_read
      ? {
          you_in_one_line: snip(current.predictive_read.you_in_one_line, 240),
          next_moves: current.predictive_read.next_moves.slice(0, 4).map(s => snip(s, 160)),
        }
      : null,
    life_domains_top: domains.slice(0, 4).map(d => ({
      id: d.id,
      salience_0_100: d.salience_0_100,
      narrative: snip(d.narrative, 280),
    })),
    behavior_recent_trend: snip(current.behavior.temporal_patterns.recent_trend, 200),
    predictions_likely_next: current.predictions.likely_next_actions.slice(0, 5).map(s => snip(s, 160)),
    derived_momentum_score: current.derived_signals.momentum_score,
  };
}

export function buildIdentityIntelligenceBundle(
  graph: IdentityGraph,
  identitySummary: string,
  inferenceCurrent: InferenceIdentityCurrent | null,
  recencyContext: string,
  userQuery?: string,
): string {
  const bundle = {
    identity_summary: snip(identitySummary, 1400),
    deterministic_graph_compact: {
      topGenres: graph.topGenres.slice(0, 12),
      topArtists: graph.topArtists.slice(0, 12),
      interests: graph.interests.slice(0, 22),
      aesthetic: graph.aesthetic,
      lifestyle: graph.lifestyle,
      brandVibes: graph.brandVibes.slice(0, 16),
      headline: snip(graph.headline, 240),
      linkedinCareerSnippet: snip(graph.linkedinCareerSnippet, 400),
      igPostingCadence: graph.igPostingCadence,
      igCreatorTier: graph.igCreatorTier,
      captionIntent: snip(graph.captionIntent, 200),
      engagementTier: graph.engagementTier,
      manualTags: graph.manualTags.slice(0, 16),
    },
    prior_domain_inference_compact: compactInference(inferenceCurrent),
    recency_context: recencyContext,
    user_query: userQuery?.trim() ? snip(userQuery.trim(), 600) : null,
  };

  let json = JSON.stringify(bundle, null, 0);
  if (json.length > 16000) {
    json = json.slice(0, 16000) + '…';
  }
  return json;
}

const SYSTEM_PROMPT = `You are a real-time identity intelligence engine — a decision layer on top of an identity graph and domain-level inference.

You are NOT an analyst. You are NOT descriptive. You produce sharp, actionable, time-relevant insight for a founder / operator.

## Thinking rules

1. RECENCY > HISTORY — What the recency_context implies about the last 24h / 7d wins over stale narrative when it signals change or momentum.
2. ONE MOVE > MANY IDEAS — decision.do_this_now must be the single highest-leverage action (specific, time-bound when possible).
3. DETECT MODE — snapshot.mode must be exactly one of: building, executing, exploring, consuming, stuck, transitioning.
4. MISALIGNMENT — If intent_primary (or predictive read) conflicts with behavior / recency, say so in blindspots or pressure — bluntly.
5. SPECIFICITY — No generic advice ("post more"). Name concrete moves (formats, audiences, time windows) grounded in the data given. If data is thin, say what is unknown and still pick a concrete probe move.
6. LEVERAGE — Prefer actions that create visibility, unlock growth, or validate direction.
7. VOICE — Founder advisor, sharp operator, slightly confrontational when needed. Never therapist tone.

## Output contract

Return ONLY one JSON object (no markdown). Shapes and required fields:

{
  "snapshot": {
    "mode": "building|executing|exploring|consuming|stuck|transitioning",
    "one_line_state": "",
    "confidence": 0
  },
  "now": { "focus": "", "pressure": "", "momentum": "" },
  "decision": {
    "do_this_now": "",
    "then_do": [],
    "stop_doing": [],
    "why_this_matters": ""
  },
  "blindspots": [ { "issue": "", "impact": "", "fix": "" } ],
  "leverage": {
    "unfair_advantages": [],
    "underused_assets": [],
    "quick_wins": []
  },
  "trajectory": {
    "direction": "",
    "risk": "",
    "next_critical_move": ""
  },
  "personalization": {
    "tone": "",
    "style": "",
    "response_format": ""
  }
}

- snapshot.confidence: number 0–1.
- All string fields non-empty except you may use empty arrays where nothing applies.
- blindspots: 1–4 items preferred; each item must have non-empty issue, impact, fix.
- then_do: ordered follow-ons (max ~5 meaningful entries).
- stop_doing: concrete habits to cut (can be empty array only if truly none — prefer at least one callout when behavior contradicts intent).`;

export async function inferIdentityIntelligenceFromBundle(bundleJson: string): Promise<IdentityIntelligenceWrapper | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });

  const userMessage = `INPUT (JSON). Produce the identity intelligence object ONLY.

${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    const payload = parseIdentityIntelligencePayload(raw);
    if (!payload) {
      console.error('[inferIdentityIntelligence] parse failed');
      return null;
    }
    const generatedAt = new Date().toISOString();
    return {
      version: IDENTITY_INTELLIGENCE_SCHEMA_VERSION,
      generatedAt,
      payload,
    };
  } catch (e) {
    console.error('[inferIdentityIntelligence]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runIdentityIntelligenceFromInputs(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  recencyContext: string;
  userQuery?: string;
}): Promise<IdentityIntelligenceWrapper | null> {
  const bundle = buildIdentityIntelligenceBundle(
    params.graph,
    params.identitySummary,
    params.inferenceCurrent,
    params.recencyContext,
    params.userQuery,
  );
  const wrap = await inferIdentityIntelligenceFromBundle(bundle);
  if (!wrap) return null;
  const q = params.userQuery?.trim();
  return { ...wrap, ...(q ? { userQuery: q } : {}) };
}

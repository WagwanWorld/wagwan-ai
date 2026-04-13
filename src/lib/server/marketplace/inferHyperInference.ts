import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { BehavioralPrecalcResult } from '$lib/server/behavioralPrecalc';
import { precalcToBundleJson } from '$lib/server/behavioralPrecalc';
import type { IdentityGraph } from '$lib/server/identity';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import {
  HYPER_INFERENCE_SCHEMA_VERSION_V2,
  type HyperInferenceWrapper,
} from '$lib/types/hyperInference';
import { parseHyperInferencePayloadV2 } from './hyperInferenceSchema';

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

function topVisualScenes(scenes: Record<string, number>, max: number): string[] {
  return Object.entries(scenes ?? {})
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

export function buildHyperInferenceBundle(
  graph: IdentityGraph,
  signalMeter: SignalMeterOutput,
  identitySummary: string,
  recencyContext: string,
  mergedProfile?: Record<string, unknown>,
  behavioralPrecalc?: BehavioralPrecalcResult | null,
): string {
  const ig = mergedProfile?.instagramIdentity as Record<string, unknown> | undefined;
  const li = mergedProfile?.linkedinIdentity as Record<string, unknown> | undefined;
  const gId = mergedProfile?.googleIdentity as Record<string, unknown> | undefined;
  const ytId = mergedProfile?.youtubeIdentity as Record<string, unknown> | undefined;
  const yt = gId?.topChannels ?? ytId?.topChannels;
  const ytCategories =
    (Array.isArray(gId?.topCategories) ? gId.topCategories : null) ??
    (Array.isArray(ytId?.topCategories) ? ytId.topCategories : null);

  const deterministic_graph_compact = {
    topGenres: graph.topGenres.slice(0, 12),
    topArtists: graph.topArtists.slice(0, 12),
    interests: graph.interests.slice(0, 25),
    aesthetic: graph.aesthetic,
    lifestyle: graph.lifestyle,
    brandVibes: graph.brandVibes.slice(0, 20),
    foodVibe: graph.foodVibe,
    travelStyle: graph.travelStyle,
    activities: graph.activities.slice(0, 15),
    visualFashionStyle: graph.visualFashionStyle,
    visual_scenes_top: topVisualScenes(graph.visualScenes ?? {}, 14),
    musicVibe: graph.musicVibe,
    budget: graph.budget,
    igPostingCadence: graph.igPostingCadence,
    igCreatorTier: graph.igCreatorTier,
    temporalPattern: graph.temporalPattern,
    temporalPeakDays: graph.temporalPeakDays,
    engagementTier: graph.engagementTier,
    topHashtags: graph.topHashtags.slice(0, 25),
    captionIntent: graph.captionIntent,
    headline: snip(graph.headline, 240),
    linkedinCareerSnippet: snip(graph.linkedinCareerSnippet, 400),
    professionalThemeTags: graph.professionalThemeTags.slice(0, 20),
    musicDescriptorTags: graph.musicDescriptorTags.slice(0, 20),
    contentCategories: graph.contentCategories.slice(0, 15),
    lifestyleSignals: graph.lifestyleSignals.slice(0, 15),
    googleSignalTags: graph.googleSignalTags.slice(0, 20),
    manualTags: graph.manualTags.slice(0, 20),
    topChannels: graph.topChannels.slice(0, 15),
    youtube_style_categories: Array.isArray(ytCategories) ? ytCategories.slice(0, 12) : [],
    musicSignalNarrative: snip(graph.musicSignalNarrative, 500),
    professionalSignalNarrative: snip(graph.professionalSignalNarrative, 500),
    lifeRhythmNarrative: snip(graph.lifeRhythmNarrative, 500),
  };

  const signal_meter_full = {
    signals: signalMeter.signals.slice(0, 80).map(s => ({
      type: s.type,
      category: s.category,
      value: snip(s.value, 200),
      context: snip(s.context, 200),
      strength: s.strength,
      confidence: s.confidence,
      recency: s.recency,
      frequency: s.frequency,
      source: s.source,
      platform_bucket: s.platform_bucket,
      platform_buckets: s.platform_buckets,
      direction: s.direction,
      base_score: s.base_score,
      final_score: s.final_score,
      scores_by_intent: s.scores_by_intent,
    })),
    clusters: signalMeter.clusters.slice(0, 20),
    dominant_patterns: signalMeter.dominant_patterns.slice(0, 25),
    noise: signalMeter.noise.slice(0, 15),
  };

  const instagram_raw = ig
    ? {
        rawSummary: snip(String(ig.rawSummary ?? ''), 900),
        igMetricsHint: snip(String(ig.igMetricsHint ?? graph.igMetricsHint ?? ''), 400),
        aesthetic: snip(String(ig.aesthetic ?? graph.aesthetic ?? ''), 120),
        mediaCount: ig.mediaCount,
        followersCount: ig.followersCount,
        igInsightsTags: Array.isArray(ig.igInsightsTags) ? ig.igInsightsTags.slice(0, 25) : [],
      }
    : null;

  const linkedin_raw = li
    ? {
        headline: snip(String(li.headline ?? ''), 280),
        careerSummary: snip(String(li.careerSummary ?? ''), 500),
        skills: Array.isArray(li.skills) ? li.skills.slice(0, 30) : [],
      }
    : null;

  const youtube_channels = Array.isArray(yt) ? yt.slice(0, 15) : [];

  const bundle = {
    identity_summary: snip(identitySummary, 1400),
    deterministic_graph_compact,
    signal_meter: signal_meter_full,
    cross_platform_snippets: {
      instagram_raw,
      linkedin_raw,
      youtube_channels,
    },
    recency_context: recencyContext,
    behavioral_precalc: behavioralPrecalc ? precalcToBundleJson(behavioralPrecalc) : null,
  };

  let json = JSON.stringify(bundle, null, 0);
  if (json.length > 19000) {
    json = json.slice(0, 19000) + '…';
  }
  return json;
}

const SYSTEM_PROMPT = `You are a behavioral intelligence engine (v2 schema).

You process multi-platform user data: Instagram, LinkedIn, Google (search/activity/calendar twin), YouTube, Apple Music, Spotify, Gmail metadata, manual tags.

There is NO single primary data source — dynamically respect behavioral_precalc.intent_classification.primary_intent_type and platform_connected when resolving contradictions.

## STEPS

1. Classify dominant intent mode (align intent_type with precalc when behavioral_precalc is present; you may refine).
2. Fuse cross-platform evidence; same theme on 2+ platforms → higher confidence; 3+ → mark as strong in supporting_signals.
3. Use negative_signals from precalc to lower confidence where patterns imply absence (e.g. consume-but-not-create).
4. Resolve contradictions explicitly in frictions / identity_gap.
5. Predictions must be probabilistic with timeframe — not vague prose.

## RULES

- RECENT + REPEATED behavior wins.
- Never fabricate purchases or orders.
- At least 2 non_obvious_insights must be sharp and NOT copy-pasted from raw lists.
- confidence.by_source: score 0–1 per platform based on signal strength + recency in the input.

## OUTPUT (strict JSON v2 only)

Return ONLY one JSON object (no markdown):

{
  "intent_type": "action|purchase|identity|taste|growth",
  "identity": { "archetype": "", "stage": "", "confidence": 0 },
  "depth_layer": {
    "core_drivers": [],
    "behavioral_loops": [],
    "decision_patterns": [],
    "attention_patterns": []
  },
  "inference_layer": {
    "true_intent": "",
    "hidden_goals": [],
    "frictions": [],
    "identity_gap": "",
    "motivations": []
  },
  "prediction_layer": [
    {
      "action": "",
      "probability": 0,
      "timeframe": "",
      "confidence": 0,
      "supporting_signals": []
    }
  ],
  "economic_profile": {
    "spending_style": "",
    "price_sensitivity": "",
    "purchase_triggers": [],
    "brand_affinity": []
  },
  "lifestyle": {
    "brands": [],
    "fashion": [],
    "music": [],
    "media": [],
    "places": []
  },
  "confidence": {
    "overall": 0,
    "by_source": {
      "instagram": 0,
      "google": 0,
      "youtube": 0,
      "linkedin": 0,
      "music": 0
    }
  },
  "non_obvious_insights": []
}

- prediction_layer: at least 2 items when data allows.
- probability and confidence fields 0–1.
- price_sensitivity may be empty string only if truly unknown; prefer a short phrase.`;

export async function inferHyperInferenceFromBundle(bundleJson: string): Promise<HyperInferenceWrapper | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });

  const userMessage = `INPUT (JSON). Produce the hyper inference object ONLY.

${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 12288,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    const payload = parseHyperInferencePayloadV2(raw);
    if (!payload) {
      console.error('[inferHyperInference] parse failed');
      return null;
    }
    const generatedAt = new Date().toISOString();
    return {
      version: HYPER_INFERENCE_SCHEMA_VERSION_V2,
      generatedAt,
      payload,
    };
  } catch (e) {
    console.error('[inferHyperInference]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runHyperInferenceFromInputs(params: {
  graph: IdentityGraph;
  signalMeter: SignalMeterOutput;
  identitySummary: string;
  recencyContext: string;
  mergedProfile?: Record<string, unknown>;
  behavioralPrecalc?: BehavioralPrecalcResult | null;
}): Promise<HyperInferenceWrapper | null> {
  const bundle = buildHyperInferenceBundle(
    params.graph,
    params.signalMeter,
    params.identitySummary,
    params.recencyContext,
    params.mergedProfile,
    params.behavioralPrecalc ?? null,
  );
  return inferHyperInferenceFromBundle(bundle);
}

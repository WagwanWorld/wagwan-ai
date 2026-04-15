import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { IdentityGraph } from '$lib/server/identity';
import type { BehavioralPrecalcResult } from '$lib/server/behavioralPrecalc';
import { precalcToBundleJson } from '$lib/server/behavioralPrecalc';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import { parseInferenceIdentityCurrent } from './inferenceIdentitySchema';
import type { DriftVector } from '$lib/server/identityDriftDetector';

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

/**
 * Raw platform-shaped payload for the model (truncated).
 */
export function buildInferenceSignalBundle(
  mergedProfile: Record<string, unknown>,
  graph: IdentityGraph,
  identitySummary: string,
  priorCurrent: InferenceIdentityCurrent | null,
  syncMeta: { meaningfulPlatformSync: boolean; updatedPlatforms: string[] },
  behavioralPrecalc?: BehavioralPrecalcResult | null,
  driftVector?: DriftVector | null,
): string {
  const ig = mergedProfile.instagramIdentity as Record<string, unknown> | undefined;
  const li = mergedProfile.linkedinIdentity as Record<string, unknown> | undefined;
  const sp = mergedProfile.spotifyIdentity as Record<string, unknown> | undefined;
  const am = mergedProfile.appleMusicIdentity as Record<string, unknown> | undefined;
  const gId = mergedProfile.googleIdentity as Record<string, unknown> | undefined;
  const ytId = mergedProfile.youtubeIdentity as Record<string, unknown> | undefined;
  const yt =
    gId?.topChannels ?? ytId?.topChannels;
  const ytCategories =
    (Array.isArray(gId?.topCategories) ? gId.topCategories : null) ??
    (Array.isArray(ytId?.topCategories) ? ytId.topCategories : null);

  const priorCompact = priorCurrent
    ? {
        intent_primary: priorCurrent.intent.primary,
        predictive_read_prior: priorCurrent.predictive_read
          ? {
              you_in_one_line: snip(priorCurrent.predictive_read.you_in_one_line, 200),
              next_moves: priorCurrent.predictive_read.next_moves.slice(0, 4).map(s => snip(s, 120)),
            }
          : null,
        life_domains_prior: (priorCurrent.life_domains ?? []).map(d => ({
          id: d.id,
          confidence: d.confidence,
          salience_0_100: d.salience_0_100,
          narrative: snip(d.narrative, 320),
        })),
      }
    : null;

  const bundle = {
    identity_summary: snip(identitySummary, 1200),
    deterministic_graph_compact: {
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
      synced_platforms_this_run: syncMeta.updatedPlatforms,
      meaningful_platform_sync: syncMeta.meaningfulPlatformSync,
    },
    instagram_raw: ig
      ? {
          rawSummary: snip(String(ig.rawSummary ?? ''), 900),
          igMetricsHint: snip(String(ig.igMetricsHint ?? graph.igMetricsHint ?? ''), 400),
          aesthetic: snip(String(ig.aesthetic ?? graph.aesthetic ?? ''), 120),
          musicVibe: snip(String(ig.musicVibe ?? graph.musicVibe ?? ''), 120),
          interests: Array.isArray(ig.interests) ? ig.interests.slice(0, 20) : [],
          brandVibes: Array.isArray(ig.brandVibes) ? ig.brandVibes.slice(0, 15) : [],
          bioRoles: Array.isArray(ig.bioRoles) ? ig.bioRoles : [],
          captionMentions: Array.isArray(ig.captionMentions) ? ig.captionMentions.slice(0, 20) : [],
          igInsightsTags: Array.isArray(ig.igInsightsTags) ? ig.igInsightsTags.slice(0, 25) : [],
          mediaCount: ig.mediaCount,
          followersCount: ig.followersCount,
        }
      : null,
    linkedin_raw: li
      ? {
          headline: snip(String(li.headline ?? ''), 280),
          careerSummary: snip(String(li.careerSummary ?? ''), 500),
          skills: Array.isArray(li.skills) ? li.skills.slice(0, 30) : [],
          professionalThemeTags: Array.isArray(li.professionalThemeTags)
            ? li.professionalThemeTags.slice(0, 20)
            : [],
        }
      : null,
    spotify_raw: sp
      ? {
          topGenres: Array.isArray(sp.topGenres) ? sp.topGenres.slice(0, 15) : [],
          topArtists: Array.isArray(sp.topArtists) ? sp.topArtists.slice(0, 15) : [],
          musicPersonality: snip(String(sp.musicPersonality ?? ''), 200),
        }
      : null,
    apple_music_raw: am
      ? {
          topGenres: Array.isArray(am.topGenres) ? am.topGenres.slice(0, 15) : [],
          topArtists: Array.isArray(am.topArtists) ? am.topArtists.slice(0, 15) : [],
        }
      : null,
    youtube_channels: Array.isArray(yt) ? yt.slice(0, 15) : [],
    prior_inference_compact: priorCompact,
    behavioral_precalc: behavioralPrecalc ? precalcToBundleJson(behavioralPrecalc) : null,
    signal_relations: behavioralPrecalc ? {
      corroborations: behavioralPrecalc.cross_platform_themes
        .filter(t => t.tier >= 2)
        .slice(0, 8)
        .map(t => ({ theme: t.label, platforms: t.platforms, strength: t.tier >= 3 ? 'high' : 'medium' })),
      contradictions: behavioralPrecalc.negative_signals
        .filter(n => n.pattern.includes('conflict'))
        .map(n => ({ pattern: n.pattern, resolution: n.implication })),
    } : null,
    drift_context: driftVector ? {
      rising: driftVector.rising.slice(0, 5),
      fading: driftVector.fading.slice(0, 5),
      transition: driftVector.transition_signal,
      intensity: driftVector.drift_intensity,
    } : null,
  };

  let json = JSON.stringify(bundle, null, 0);
  if (json.length > 15000) {
    json = json.slice(0, 15000) + '…';
  }
  return json;
}

const DOMAIN_IDS_LINE =
  'music, shopping_style, career_work, sports_fitness, social_creator, travel_food, wellness, tech_media';

const SYSTEM_PROMPT = `You are an advanced identity inference engine across LIFE DOMAINS (music, shopping/style, career, sports, social/creator, travel/food, wellness, tech/media).

Transform raw user data into a structured graph that captures behavior, intent, and trajectory — NOT surface tags.

FORBIDDEN generic labels: "entrepreneur", "designer", "productivity-focused" unless tightly tied to observed behavior.

## VOICE (critical)

- Prefer second person in intent.primary, life_domains narratives, predictions, and predictive_read ("you", "your feed", "your rotation").
- Write like a tight personal briefing, not a report.

## PREDICTIVE_READ (required)

Include top-level predictive_read:
- you_in_one_line: one punchy second-person sentence that makes the user feel understood.
- next_moves: 3–5 plain sentences, each concrete and time-grounded (next ~2 weeks or ~1–3 months)—actions they might take (events, research buys, posts, trips, career steps), NOT vague categories.
- commerce_affinity: 3–6 hedged lines: recurring brands, aesthetics, product classes. Use "signals suggest…", "your feed keeps circling…", "listening points to…". NEVER claim they bought something without evidence; NEVER invent order history.

## PREDICTIONS

- likely_next_actions: 3–5 concrete lines; may overlap next_moves; keep actionable.

## COMMERCE SAFETY

- No fabricated purchases or receipts.
- shopping_style: specific brands/types from IG, brandVibes, YouTube/Google—evidence must have valid source.
- music / tech_media: name artists, channels, gear when data supports.

## DOMAIN BALANCE (critical)

- Do NOT overweight LinkedIn when Instagram, Spotify/Apple Music, or YouTube signals are strong.
- intent.primary MUST summarize the WHOLE person across domains, not a job title alone.
- stage.category = life chapter / situation; do NOT default to job role unless career_work has high salience_0_100.

## LIFE_DOMAINS (required)

Exactly 8 objects, ids: ${DOMAIN_IDS_LINE}. Unique ids.

Each domain MUST appear. Thin data: low confidence/salience, narrative notes insufficient_signal + missing platforms.

Per domain: label; narrative (2–4 sentences, second person where natural); evidence {text, source}; signals; consumption_vs_creation; likely_next (1–3 domain predictions); salience_0_100 0–100.

## OTHER RULES

1. Behavior beats self-description.
2. Patterns over keywords.
3. If prior_inference_compact is present, refine domains and predictive_read; do not discard without contradicting evidence.

## BEHAVIORAL_PRECALC (when present in INPUT JSON)

If behavioral_precalc is non-null:
- Respect intent_classification.primary_intent_type as the dominant mode — weight narratives toward that intent without erasing other domains.
- Use cross_platform themes as higher-confidence anchors (tier 3 = strong multi-platform truth).
- Apply negative_signals to temper overconfident predictions where patterns imply absence (e.g. low engagement → do not assert heavy posting intent).

When signal_relations is present:
- corroborations: themes confirmed across multiple platforms — treat as high-confidence anchors
- contradictions: conflicting signals with resolution guidance — follow the resolution, do not infer both sides

## OUTPUT

Return ONLY one JSON object (no markdown):

{
  "predictive_read": { "you_in_one_line": "", "next_moves": [], "commerce_affinity": [] },
  "intent": { "primary": "", "secondary": [], "confidence": 0 },
  "stage": { "category": "", "confidence": 0 },
  "behavior": {
    "creation_patterns": { "frequency": "", "content_types": [], "original_vs_consumption_ratio": "" },
    "engagement_patterns": { "engages_with": [], "interaction_depth": "", "network_type": "" },
    "temporal_patterns": { "active_hours": [], "consistency": "", "recent_trend": "" }
  },
  "interests": { "explicit": [], "latent": [] },
  "needs": { "immediate": [], "emerging": [] },
  "trajectory": { "direction": "", "velocity": "", "stage_shift_signals": [] },
  "derived_signals": {
    "builder_score": 0,
    "creator_score": 0,
    "consumer_score": 0,
    "momentum_score": 0,
    "taste_profile": "",
    "risk_appetite": ""
  },
  "content_profile": { "style": "", "themes": [], "strengths": [], "gaps": [] },
  "predictions": { "likely_next_actions": [], "short_term": [], "long_term": [] },
  "life_domains": [
    {
      "id": "music",
      "label": "",
      "confidence": 0,
      "salience_0_100": 0,
      "narrative": "",
      "evidence": [{ "text": "", "source": "spotify" }],
      "signals": [],
      "consumption_vs_creation": "",
      "likely_next": []
    }
  ]
}

life_domains length must be 8. intent/stage/derived confidences 0–1. builder_score etc. 0–100 integers.`;

export async function inferIdentityGraphEvolved(userMessage: string): Promise<InferenceIdentityCurrent | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    return parseInferenceIdentityCurrent(raw);
  } catch (e) {
    console.error('[inferIdentityGraph]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runInferenceFromBundle(bundleJson: string): Promise<InferenceIdentityCurrent | null> {
  const userMessage = `INPUT (JSON). Infer the identity graph. Include predictive_read (you_in_one_line, next_moves, commerce_affinity) and all required fields. Output only the strict JSON object.

${bundleJson}`;
  return inferIdentityGraphEvolved(userMessage);
}

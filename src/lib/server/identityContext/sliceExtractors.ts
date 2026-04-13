import type { ContextSliceId } from '$lib/types/contextPack';
import {
  HYPER_INFERENCE_SCHEMA_VERSION_V1,
  HYPER_INFERENCE_SCHEMA_VERSION_V2,
  type HyperInferencePayload,
  type HyperInferencePayloadV2,
  type HyperInferenceWrapper,
} from '$lib/types/hyperInference';

function hyperPayloadV1(h: HyperInferenceWrapper | null): HyperInferencePayload | null {
  return h?.version === HYPER_INFERENCE_SCHEMA_VERSION_V1 ? h.payload : null;
}

function hyperPayloadV2(h: HyperInferenceWrapper | null): HyperInferencePayloadV2 | null {
  return h?.version === HYPER_INFERENCE_SCHEMA_VERSION_V2 ? h.payload : null;
}
import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import type { SignalMeterOutput } from '$lib/types/signalMeter';

function gStr(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  return typeof v === 'string' ? v.trim() : '';
}

function gStrArr(r: Record<string, unknown>, key: string, cap: number): string[] {
  const v = r[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, cap);
}

export interface GraphExtractionContext {
  graph: Record<string, unknown>;
  inference: InferenceIdentityWrapper | null;
  hyper: HyperInferenceWrapper | null;
  snapshot: IdentitySnapshotWrapper | null;
  intel: IdentityIntelligenceWrapper | null;
  recencyBlock: string;
  signalMeter: SignalMeterOutput | null;
}

export function extractSlice(id: ContextSliceId, ctx: GraphExtractionContext): unknown {
  if (id === 'top_signals') return null;

  const { graph, inference, hyper, snapshot, intel, recencyBlock, signalMeter } = ctx;
  const cur = inference?.current ?? null;
  const hp1 = hyperPayloadV1(hyper);
  const hp2 = hyperPayloadV2(hyper);
  const ip = intel?.payload;
  const sp = snapshot?.payload;

  switch (id) {
    case 'persona': {
      if (!sp) return null;
      return {
        one_liner: sp.one_liner,
        archetype: sp.archetype,
        vibe: sp.vibe?.slice(0, 8),
        identity_tags: sp.identity_tags?.slice(0, 12),
        current_mode: sp.current_mode,
        core_contradiction: sp.core_contradiction?.slice(0, 280),
      };
    }
    case 'identity_tags': {
      const fromSnap = sp?.identity_tags ?? [];
      const manual = gStrArr(graph, 'manualTags', 12);
      return { tags: [...new Set([...fromSnap, ...manual])].slice(0, 16) };
    }
    case 'archetype': {
      const snapArch = sp?.archetype ?? '';
      const line = cur?.predictive_read?.you_in_one_line?.trim() ?? '';
      if (!snapArch && !line) return null;
      return { archetype: snapArch, predictive_one_liner: line };
    }
    case 'vibe': {
      return {
        snapshot_vibe: sp?.vibe?.slice(0, 8) ?? [],
        aesthetic: gStr(graph, 'aesthetic').slice(0, 200),
        music_vibe: gStr(graph, 'musicVibe').slice(0, 200),
        style_query_hint: gStr(graph, 'queryStyleHint').slice(0, 200),
      };
    }
    case 'current_state': {
      const next7 = hp2
        ? hp2.prediction_layer.slice(0, 5).map(p => p.action)
        : hp1
          ? hp1.prediction_layer.next_7_days.slice(0, 5)
          : [];
      const trueIntent = hp2?.inference_layer.true_intent ?? hp1?.inference_layer.true_intent;
      return {
        intelligence_snapshot: ip?.snapshot,
        intelligence_now: ip?.now,
        hyper_true_intent: trueIntent?.slice(0, 280),
        hyper_next_7_days: next7,
        primary_intent: cur?.intent?.primary,
      };
    }
    case 'decision_layer': {
      if (!ip) return null;
      const highConf = hp2
        ? Object.entries(hp2.confidence.by_source)
            .filter(([, v]) => v >= 0.65)
            .map(([k]) => k)
        : hp1
          ? hp1.confidence_matrix.high_confidence.slice(0, 6)
          : [];
      return {
        decision: ip.decision,
        blindspots: ip.blindspots?.slice(0, 4),
        high_confidence: highConf,
      };
    }
    case 'recency_signals': {
      return { recency: recencyBlock.slice(0, 4_000) };
    }
    case 'top_misalignment': {
      const gaps = cur?.content_profile?.gaps ?? [];
      const insights = (hp2?.non_obvious_insights ?? hp1?.non_obvious_insights)?.slice(0, 6) ?? [];
      if (!gaps.length && !insights.length) return null;
      return { content_gaps: gaps.slice(0, 8), non_obvious_insights: insights };
    }
    case 'behavior_patterns': {
      if (!cur?.behavior) return null;
      return { behavior: cur.behavior };
    }
    case 'content_profile': {
      if (!cur?.content_profile) return null;
      return { content_profile: cur.content_profile };
    }
    case 'gaps': {
      const cp = cur?.content_profile;
      if (!cp) return null;
      return {
        gaps: Gslice(cp.gaps, 8),
        strengths: Gslice(cp.strengths, 6),
        themes: cp.themes?.slice(0, 6),
      };
    }
    case 'trajectory': {
      if (!cur) return null;
      return {
        trajectory: cur.trajectory,
        derived_signals: cur.derived_signals,
      };
    }
    case 'lifestyle': {
      return {
        lifestyle: gStr(graph, 'lifestyle').slice(0, 400),
        activities: gStrArr(graph, 'activities', 10),
        life_rhythm: gStr(graph, 'lifeRhythmNarrative').slice(0, 400),
        city: gStr(graph, 'city').slice(0, 80),
      };
    }
    case 'taste_profile': {
      const hyperTaste = hp2
        ? {
            brands: hp2.lifestyle.brands,
            fashion: hp2.lifestyle.fashion,
            music: hp2.lifestyle.music,
            media: hp2.lifestyle.media,
          }
        : hp1
          ? hp1.taste_profile
          : undefined;
      return {
        snapshot_taste: sp?.taste,
        hyper_taste: hyperTaste,
        music_narrative: gStr(graph, 'musicSignalNarrative').slice(0, 400),
        shopping_style: sp?.shopping_style,
      };
    }
    case 'brands': {
      return {
        brand_vibes: gStrArr(graph, 'brandVibes', 10),
        snapshot_brands: sp?.aesthetic_profile?.brands?.slice(0, 10),
      };
    }
    case 'music': {
      return {
        top_artists: gStrArr(graph, 'topArtists', 8),
        top_genres: gStrArr(graph, 'topGenres', 8),
        music_vibe: gStr(graph, 'musicVibe').slice(0, 200),
        music_personality: gStr(graph, 'musicPersonality').slice(0, 220),
      };
    }
    case 'media': {
      return {
        content_categories: gStrArr(graph, 'contentCategories', 8),
        top_channels: gStrArr(graph, 'topChannels', 8),
        content_personality: gStr(graph, 'contentPersonality').slice(0, 220),
      };
    }
    case 'prediction_layer': {
      const hyperPred = hp2?.prediction_layer ?? hp1?.prediction_layer;
      return {
        hyper_predictions: hyperPred,
        inference_predictions: cur?.predictions,
        likely_next_actions: cur?.predictions?.likely_next_actions?.slice(0, 10),
      };
    }
    case 'momentum': {
      const mom = cur?.derived_signals?.momentum_score;
      const clusters = signalMeter?.clusters ?? [];
      const topCluster = [...clusters].sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0))[0];
      if (mom == null && !topCluster) return null;
      return {
        momentum_score: mom,
        top_cluster_theme: topCluster?.theme,
        top_cluster_intensity: topCluster?.intensity,
      };
    }
    case 'economic_profile': {
      const econ = hp2?.economic_profile ?? hp1?.economic_profile;
      if (!econ) return null;
      return {
        spending_style: econ.spending_style,
        price_sensitivity: econ.price_sensitivity,
        purchase_triggers: econ.purchase_triggers?.slice(0, 6),
      };
    }
    case 'risk_flags': {
      const low = hp2
        ? Object.entries(hp2.confidence.by_source)
            .filter(([, v]) => v < 0.45)
            .map(([k, v]) => `${k}:${v.toFixed(2)}`)
        : hp1
          ? hp1.confidence_matrix.low_confidence.slice(0, 8)
          : [];
      const trajRisk = ip?.trajectory?.risk?.trim() ?? '';
      if (!low.length && !trajRisk) return null;
      return { low_confidence_signals: low, trajectory_risk: trajRisk };
    }
    case 'opportunity_layer': {
      const actions = cur?.predictions?.likely_next_actions?.slice(0, 8) ?? [];
      const qw = ip?.leverage?.quick_wins?.slice(0, 6) ?? [];
      if (!actions.length && !qw.length) return null;
      return { likely_next_actions: actions, quick_wins: qw };
    }
    default:
      return null;
  }
}

function Gslice<T>(arr: T[] | undefined, cap: number): T[] {
  return Array.isArray(arr) ? arr.slice(0, cap) : [];
}

/** Ensure anchors for compression when intent omitted persona/state slices. */
export function applySliceAnchors(
  _sliceIds: ContextSliceId[],
  slices: Record<string, unknown>,
  ctx: GraphExtractionContext,
): void {
  if (!slices.persona) {
    const p = extractSlice('persona', ctx);
    if (p) slices.persona = p;
  }
  if (!slices.current_state) {
    const s = extractSlice('current_state', ctx);
    if (s) slices.current_state = s;
  }
}

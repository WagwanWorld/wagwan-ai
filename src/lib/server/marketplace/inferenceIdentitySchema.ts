/**
 * Runtime parse/merge for identity_graph.inferenceIdentity (server).
 * Types live in `$lib/types/inferenceIdentity`.
 */

import {
  INFERENCE_HISTORY_CAP,
  INFERENCE_LIFE_DOMAIN_IDS,
  INFERENCE_SCHEMA_VERSION,
  INFERENCE_SCHEMA_VERSION_V1,
  INFERENCE_SCHEMA_VERSION_V2,
  type InferenceEvidenceBullet,
  type InferenceEvidenceSource,
  type InferenceHistoryEntry,
  type InferenceIdentityCurrent,
  type InferenceIdentityWrapper,
  type InferenceLifeDomain,
  type InferencePredictiveRead,
  type InferenceSchemaVersion,
} from '$lib/types/inferenceIdentity';

export type {
  InferenceIdentityCurrent,
  InferenceIdentityWrapper,
  InferenceHistoryEntry,
  InferenceLifeDomain,
  InferencePredictiveRead,
} from '$lib/types/inferenceIdentity';

export {
  INFERENCE_SCHEMA_VERSION,
  INFERENCE_SCHEMA_VERSION_V1,
  INFERENCE_SCHEMA_VERSION_V2,
  INFERENCE_HISTORY_CAP,
  INFERENCE_LIFE_DOMAIN_IDS,
} from '$lib/types/inferenceIdentity';

const EVIDENCE_SOURCES = new Set<string>([
  'instagram',
  'spotify',
  'apple_music',
  'youtube',
  'google',
  'linkedin',
  'manual',
  'inferred_cross',
]);

const DOMAIN_ID_SET = new Set<string>(INFERENCE_LIFE_DOMAIN_IDS as readonly string[]);

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function num01(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function _num0100(x: unknown): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(100, Math.max(0, Math.round(x)));
}

function str(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function strArr(x: unknown): string[] {
  if (Array.isArray(x)) return x.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean);
  return [];
}

function parseEvidence(arr: unknown): InferenceEvidenceBullet[] {
  if (!Array.isArray(arr)) return [];
  const out: InferenceEvidenceBullet[] = [];
  for (const e of arr) {
    if (!isObj(e)) continue;
    const text = str(e.text);
    if (!text) continue;
    const srcRaw = str(e.source);
    const source: InferenceEvidenceSource = EVIDENCE_SOURCES.has(srcRaw)
      ? (srcRaw as InferenceEvidenceSource)
      : 'inferred_cross';
    out.push({ text, source });
    if (out.length >= 14) break;
  }
  return out;
}

function parsePredictiveRead(raw: unknown): InferencePredictiveRead | undefined {
  if (!isObj(raw)) return undefined;
  const you_in_one_line = str(raw.you_in_one_line);
  if (!you_in_one_line) return undefined;
  const next_moves = strArr(raw.next_moves).slice(0, 6);
  if (!next_moves.length) return undefined;
  const commerce_affinity = strArr(raw.commerce_affinity).slice(0, 8);
  return { you_in_one_line, next_moves, commerce_affinity };
}

function parseLifeDomains(raw: unknown): InferenceLifeDomain[] | null {
  if (!Array.isArray(raw) || raw.length !== INFERENCE_LIFE_DOMAIN_IDS.length) return null;
  const seen = new Set<string>();
  const parsed: InferenceLifeDomain[] = [];

  for (const item of raw) {
    if (!isObj(item)) return null;
    const id = str(item.id);
    if (!DOMAIN_ID_SET.has(id) || seen.has(id)) return null;
    seen.add(id);

    const conf = num01(item.confidence);
    if (conf === null) return null;
    const narrative = str(item.narrative);
    if (!narrative) return null;
    const label = str(item.label) || id;

    let salience = _num0100(item.salience_0_100);
    if (salience === null) salience = Math.round(conf * 100);

    const consumption_vs_creation = str(item.consumption_vs_creation);

    parsed.push({
      id: id as InferenceLifeDomain['id'],
      label,
      confidence: conf,
      salience_0_100: salience,
      narrative,
      evidence: parseEvidence(item.evidence),
      signals: strArr(item.signals).slice(0, 24),
      consumption_vs_creation,
      likely_next: strArr(item.likely_next).slice(0, 5),
    });
  }

  if (seen.size !== INFERENCE_LIFE_DOMAIN_IDS.length) return null;

  const order = new Map(INFERENCE_LIFE_DOMAIN_IDS.map((id, i) => [id, i] as const));
  parsed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return parsed;
}

function parseIdentityCore(raw: Record<string, unknown>): Omit<InferenceIdentityCurrent, 'life_domains'> | null {
  const intentO = raw.intent;
  if (!isObj(intentO)) return null;
  const ic = num01(intentO.confidence);
  const primary = str(intentO.primary);
  if (!primary || ic === null) return null;

  const stageO = raw.stage;
  if (!isObj(stageO)) return null;
  const sc = num01(stageO.confidence);
  const stageCat = str(stageO.category);
  if (!stageCat || sc === null) return null;

  const behaviorO = raw.behavior;
  if (!isObj(behaviorO)) return null;
  const cr = behaviorO.creation_patterns;
  const en = behaviorO.engagement_patterns;
  const te = behaviorO.temporal_patterns;
  if (!isObj(cr) || !isObj(en) || !isObj(te)) return null;
  if (
    !str(cr.frequency) ||
    !str(cr.original_vs_consumption_ratio) ||
    !str(en.interaction_depth) ||
    !str(en.network_type) ||
    !str(te.consistency) ||
    !str(te.recent_trend)
  ) {
    return null;
  }

  const interestsO = raw.interests;
  const needsO = raw.needs;
  const trajO = raw.trajectory;
  const derivedO = raw.derived_signals;
  const contentO = raw.content_profile;
  const predO = raw.predictions;
  if (!isObj(interestsO) || !isObj(needsO) || !isObj(trajO) || !isObj(derivedO) || !isObj(contentO) || !isObj(predO)) {
    return null;
  }

  const dBuilder = _num0100(derivedO.builder_score);
  const dCreator = _num0100(derivedO.creator_score);
  const dConsumer = _num0100(derivedO.consumer_score);
  const dMom = _num0100(derivedO.momentum_score);
  if (dBuilder === null || dCreator === null || dConsumer === null || dMom === null) return null;
  if (!str(derivedO.taste_profile) || !str(derivedO.risk_appetite)) return null;

  if (!str(trajO.direction) || !str(trajO.velocity)) return null;
  if (!str(contentO.style)) return null;

  return {
    intent: {
      primary,
      secondary: strArr(intentO.secondary),
      confidence: ic,
    },
    stage: { category: stageCat, confidence: sc },
    behavior: {
      creation_patterns: {
        frequency: str(cr.frequency),
        content_types: strArr(cr.content_types),
        original_vs_consumption_ratio: str(cr.original_vs_consumption_ratio),
      },
      engagement_patterns: {
        engages_with: strArr(en.engages_with),
        interaction_depth: str(en.interaction_depth),
        network_type: str(en.network_type),
      },
      temporal_patterns: {
        active_hours: strArr(te.active_hours),
        consistency: str(te.consistency),
        recent_trend: str(te.recent_trend),
      },
    },
    interests: {
      explicit: strArr(interestsO.explicit),
      latent: strArr(interestsO.latent),
    },
    needs: {
      immediate: strArr(needsO.immediate),
      emerging: strArr(needsO.emerging),
    },
    trajectory: {
      direction: str(trajO.direction),
      velocity: str(trajO.velocity),
      stage_shift_signals: strArr(trajO.stage_shift_signals),
    },
    derived_signals: {
      builder_score: dBuilder,
      creator_score: dCreator,
      consumer_score: dConsumer,
      momentum_score: dMom,
      taste_profile: str(derivedO.taste_profile),
      risk_appetite: str(derivedO.risk_appetite),
    },
    content_profile: {
      style: str(contentO.style),
      themes: strArr(contentO.themes),
      strengths: strArr(contentO.strengths),
      gaps: strArr(contentO.gaps),
    },
    predictions: {
      likely_next_actions: strArr(predO.likely_next_actions),
      short_term: strArr(predO.short_term),
      long_term: strArr(predO.long_term),
    },
  };
}

export function parseInferenceIdentityCurrentV1(raw: unknown): InferenceIdentityCurrent | null {
  if (!isObj(raw)) return null;
  const core = parseIdentityCore(raw);
  if (!core) return null;
  const predictive_read = parsePredictiveRead(raw.predictive_read);
  return { ...core, ...(predictive_read ? { predictive_read } : {}) };
}

export function parseInferenceIdentityCurrentV2(raw: unknown): InferenceIdentityCurrent | null {
  if (!isObj(raw)) return null;
  const core = parseIdentityCore(raw);
  if (!core) return null;
  const life_domains = parseLifeDomains(raw.life_domains);
  if (!life_domains) return null;
  const predictive_read = parsePredictiveRead(raw.predictive_read);
  return { ...core, life_domains, ...(predictive_read ? { predictive_read } : {}) };
}

/** Prefer validated v2; accept v1-shaped payloads (e.g. legacy or truncated model output). */
export function parseInferenceIdentityCurrent(raw: unknown): InferenceIdentityCurrent | null {
  const v2 = parseInferenceIdentityCurrentV2(raw);
  if (v2) return v2;
  return parseInferenceIdentityCurrentV1(raw);
}

export function parseInferenceIdentityWrapper(raw: unknown): InferenceIdentityWrapper | null {
  if (!isObj(raw)) return null;
  const ver = raw.schemaVersion;
  if (ver !== INFERENCE_SCHEMA_VERSION_V1 && ver !== INFERENCE_SCHEMA_VERSION_V2) return null;
  if (typeof raw.revision !== 'number' || !Number.isFinite(raw.revision) || raw.revision < 0) return null;
  if (typeof raw.inferredAt !== 'string' || !raw.inferredAt.trim()) return null;

  const current =
    ver === INFERENCE_SCHEMA_VERSION_V2
      ? parseInferenceIdentityCurrentV2(raw.current)
      : parseInferenceIdentityCurrentV1(raw.current);
  if (!current) return null;

  const hist = Array.isArray(raw.history) ? raw.history : [];
  const history: InferenceHistoryEntry[] = [];
  for (const h of hist) {
    if (!isObj(h)) continue;
    const inferredAt = str(h.inferredAt);
    if (!inferredAt) continue;
    const revision = typeof h.revision === 'number' && Number.isFinite(h.revision) ? h.revision : 0;
    history.push({
      inferredAt,
      revision,
      summaryDelta: str(h.summaryDelta) || undefined,
      intentPrimary: str(h.intentPrimary) || undefined,
      momentumScore:
        typeof h.momentumScore === 'number' && Number.isFinite(h.momentumScore)
          ? Math.min(100, Math.max(0, Math.round(h.momentumScore)))
          : undefined,
    });
  }

  return {
    schemaVersion: ver as InferenceSchemaVersion,
    revision: Math.floor(raw.revision),
    inferredAt: raw.inferredAt.trim(),
    current,
    history,
  };
}

/** Build next wrapper from validated current model output. */
export function mergeNextInference(
  prior: InferenceIdentityWrapper | null,
  current: InferenceIdentityCurrent,
  summaryDelta?: string,
): InferenceIdentityWrapper {
  const now = new Date().toISOString();
  const nextRev = prior ? prior.revision + 1 : 0;
  const history: InferenceHistoryEntry[] = [...(prior?.history ?? [])];
  if (prior?.current) {
    history.push({
      inferredAt: prior.inferredAt,
      revision: prior.revision,
      summaryDelta: summaryDelta || undefined,
      intentPrimary: prior.current.intent.primary,
      momentumScore: prior.current.derived_signals.momentum_score,
    });
  }
  while (history.length > INFERENCE_HISTORY_CAP) history.shift();

  const schemaVersion: InferenceSchemaVersion =
    current.life_domains && current.life_domains.length === INFERENCE_LIFE_DOMAIN_IDS.length
      ? INFERENCE_SCHEMA_VERSION_V2
      : INFERENCE_SCHEMA_VERSION_V1;

  return {
    schemaVersion,
    revision: nextRev,
    inferredAt: now,
    current,
    history,
  };
}

export function pickInferenceFromGraph(graph: Record<string, unknown>): unknown {
  return graph.inferenceIdentity;
}

export function omitInferenceFromGraph<T extends Record<string, unknown>>(graph: T): Omit<T, 'inferenceIdentity'> {
  const { inferenceIdentity: _, ...rest } = graph;
  return rest;
}

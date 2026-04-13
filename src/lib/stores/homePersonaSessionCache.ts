import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import type { IdentitySynthesisWrapper } from '$lib/types/identitySynthesis';

/** Matches Home signal highlight rows from GET /api/user/persona */
export type HomePersonaSignalHighlight = {
  type: string;
  category: string;
  value: string;
  final_score: number;
};

export type HomePersonaSignalCluster = {
  theme: string;
  intensity: number;
  signals: string[];
};

export type HomePersonaInferenceCompact = {
  intent_primary?: string;
  predictive_one_liner?: string;
  life_domains_top?: Array<{ id: string; label: string; salience: number }>;
};

export type HomePersonaHyperInferenceCompact = {
  taste_mechanism?: string;
  true_intent?: string;
  next_7_days?: string[];
  next_30_days?: string[];
  non_obvious_insights?: string[];
  high_confidence?: string[];
  intent_type?: string;
  archetype?: string;
  predictions?: Array<{ action?: string; probability?: number; timeframe?: string }>;
  confidence_by_source?: Record<string, number>;
  overall_confidence?: number;
};

const CACHE_VERSION = 2 as const;
const KEY_PREFIX = `wagwan_home_persona_v${CACHE_VERSION}:`;

export type HomePersonaSessionPayload = {
  identitySynthesis: IdentitySynthesisWrapper | null;
  identitySnapshot: IdentitySnapshotWrapper | null;
  identityIntelligence: IdentityIntelligenceWrapper | null;
  signalHighlights: HomePersonaSignalHighlight[];
  signalClusters: HomePersonaSignalCluster[];
  signalDominantPatterns: string[];
  inferenceCompact: HomePersonaInferenceCompact | null;
  inference: InferenceIdentityWrapper | null;
  hyperInferenceCompact: HomePersonaHyperInferenceCompact | null;
};

type StoredEnvelope = { v: typeof CACHE_VERSION } & HomePersonaSessionPayload;

function keyForSub(googleSub: string): string {
  return KEY_PREFIX + googleSub;
}

export function loadHomePersonaFromSession(googleSub: string | undefined | null): HomePersonaSessionPayload | null {
  if (typeof sessionStorage === 'undefined') return null;
  const sub = googleSub?.trim();
  if (!sub) return null;
  try {
    const raw = sessionStorage.getItem(keyForSub(sub));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Partial<StoredEnvelope>;
    if (o.v !== CACHE_VERSION) return null;
    return {
      identitySynthesis: o.identitySynthesis ?? null,
      identitySnapshot: o.identitySnapshot ?? null,
      identityIntelligence: o.identityIntelligence ?? null,
      signalHighlights: Array.isArray(o.signalHighlights) ? o.signalHighlights : [],
      signalClusters: Array.isArray(o.signalClusters) ? o.signalClusters : [],
      signalDominantPatterns: Array.isArray(o.signalDominantPatterns) ? o.signalDominantPatterns : [],
      inferenceCompact: o.inferenceCompact ?? null,
      inference: o.inference ?? null,
      hyperInferenceCompact: o.hyperInferenceCompact ?? null,
    };
  } catch {
    return null;
  }
}

export function saveHomePersonaToSession(
  googleSub: string | undefined | null,
  payload: HomePersonaSessionPayload,
): void {
  if (typeof sessionStorage === 'undefined') return;
  const sub = googleSub?.trim();
  if (!sub) return;
  try {
    const envelope: StoredEnvelope = { v: CACHE_VERSION, ...payload };
    sessionStorage.setItem(keyForSub(sub), JSON.stringify(envelope));
  } catch {
    /* quota or private mode */
  }
}

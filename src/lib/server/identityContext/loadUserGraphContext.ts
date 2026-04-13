import { getProfile, isSupabaseConfigured, type UserProfileRow } from '$lib/server/supabase';
import { buildRecencyContext } from '$lib/server/marketplace/buildRecencyContext';
import { parseHyperInferenceWrapper } from '$lib/server/marketplace/hyperInferenceSchema';
import { parseIdentityIntelligenceWrapper } from '$lib/server/marketplace/identityIntelligenceSchema';
import { parseIdentitySnapshotWrapper } from '$lib/server/marketplace/identitySnapshotSchema';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';
import type { HyperInferenceWrapper } from '$lib/types/hyperInference';
import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import type { GraphExtractionContext } from './sliceExtractors';

export interface LoadedUserContext {
  row: UserProfileRow;
  graph: Record<string, unknown>;
  identitySummary: string;
  inference: InferenceIdentityWrapper | null;
  hyper: HyperInferenceWrapper | null;
  snapshot: IdentitySnapshotWrapper | null;
  intel: IdentityIntelligenceWrapper | null;
  signalMeter: SignalMeterOutput | null;
  recencyBlock: string;
}

export function rowToExtractionContext(loaded: LoadedUserContext): GraphExtractionContext {
  return {
    graph: loaded.graph,
    inference: loaded.inference,
    hyper: loaded.hyper,
    snapshot: loaded.snapshot,
    intel: loaded.intel,
    recencyBlock: loaded.recencyBlock,
    signalMeter: loaded.signalMeter,
  };
}

export async function loadUserGraphContext(googleSub: string): Promise<LoadedUserContext | null> {
  if (!isSupabaseConfigured() || !googleSub.trim()) return null;
  const row = await getProfile(googleSub.trim());
  if (!row) return null;

  const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
  const profileData = row.profile_data as Record<string, unknown>;

  const inference = parseInferenceIdentityWrapper(graph.inferenceIdentity);
  const hyper = parseHyperInferenceWrapper(graph.hyperInference);
  const snapshot = parseIdentitySnapshotWrapper(graph.identitySnapshot);
  const intel = parseIdentityIntelligenceWrapper(graph.identityIntelligence);
  const signalMeter = (graph.signalMeter as SignalMeterOutput | undefined) ?? null;

  const recencyBlock = buildRecencyContext({
    profileData,
    updatedPlatformKeys: [],
    includeMicroSignals: false,
  });

  return {
    row,
    graph,
    identitySummary: row.identity_summary ?? '',
    inference,
    hyper,
    snapshot,
    intel,
    signalMeter,
    recencyBlock,
  };
}

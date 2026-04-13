import { getIdentityGraph, getIdentityGraphBlob, isSupabaseConfigured } from './supabase';
import { buildIdentityGraph, identitySummary, type IdentityGraph } from './identity';

export interface ResolvedGraph {
  graph: IdentityGraph;
  summary: string;
  source: 'supabase' | 'computed';
}

/**
 * Prefer the identity graph built from the **client profile payload** whenever
 * the client sent a real session (connected services, setup, or interests).
 * A cached Supabase graph can lag behind after the user connects Apple Music,
 * LinkedIn, etc. from profile; using it would ignore those signals.
 *
 * Falls back to the stored graph only when the profile body is effectively empty.
 */
async function mergePersistedGraphLayers(
  googleSub: string | undefined | null,
  graph: IdentityGraph,
): Promise<IdentityGraph> {
  if (!googleSub || !isSupabaseConfigured()) return graph;
  try {
    const blob = await getIdentityGraphBlob(googleSub);
    if (!blob) return graph;
    const next: IdentityGraph = { ...graph };
    if (blob.inferenceIdentity && typeof blob.inferenceIdentity === 'object') {
      next.inferenceIdentity = blob.inferenceIdentity as IdentityGraph['inferenceIdentity'];
    }
    if (blob.hyperInference && typeof blob.hyperInference === 'object') {
      next.hyperInference = blob.hyperInference as IdentityGraph['hyperInference'];
    }
    if (blob.memoryGraph && typeof blob.memoryGraph === 'object') {
      next.memoryGraph = blob.memoryGraph as IdentityGraph['memoryGraph'];
    }
    if (blob.identityIntelligence && typeof blob.identityIntelligence === 'object') {
      next.identityIntelligence = blob.identityIntelligence as IdentityGraph['identityIntelligence'];
    }
    if (blob.expressionLayer && typeof blob.expressionLayer === 'object') {
      next.expressionLayer = blob.expressionLayer as IdentityGraph['expressionLayer'];
    }
    if (blob.expressionFeedback && typeof blob.expressionFeedback === 'object') {
      next.expressionFeedback = blob.expressionFeedback as IdentityGraph['expressionFeedback'];
    }
    return next;
  } catch (e) {
    console.error('[resolveGraph] merge persisted layers failed:', e);
    return graph;
  }
}

export async function resolveIdentityGraph(
  googleSub: string | undefined | null,
  profile: Record<string, unknown>,
): Promise<ResolvedGraph> {
  const hasClientSignals = Boolean(
    profile?.setupComplete ||
      profile?.instagramConnected ||
      profile?.spotifyConnected ||
      profile?.appleMusicConnected ||
      profile?.linkedinConnected ||
      profile?.googleConnected ||
      profile?.youtubeConnected ||
      (Array.isArray(profile?.interests) && (profile.interests as unknown[]).length > 0),
  );

  if (hasClientSignals) {
    let graph = buildIdentityGraph(profile);
    graph = await mergePersistedGraphLayers(googleSub, graph);
    return { graph, summary: identitySummary(graph), source: 'computed' };
  }

  if (googleSub && isSupabaseConfigured()) {
    try {
      const stored = await getIdentityGraph(googleSub);
      if (stored && Object.keys(stored.graph).length > 0 && stored.summary) {
        return {
          graph: stored.graph as unknown as IdentityGraph,
          summary: stored.summary,
          source: 'supabase',
        };
      }
    } catch (e) {
      console.error('[resolveGraph] Supabase read failed, falling back:', e);
    }
  }

  const graph = buildIdentityGraph(profile);
  return { graph, summary: identitySummary(graph), source: 'computed' };
}

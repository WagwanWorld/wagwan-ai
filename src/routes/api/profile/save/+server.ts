import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  upsertProfile,
  upsertIdentityGraph,
  getManualInterestTags,
  getProfile,
  isSupabaseConfigured,
} from '$lib/server/supabase';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';
import { buildSignalMeter } from '$lib/server/signalMeter';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  /** Primary key: Google OIDC `sub`, or `ig:<graphUserId>` / `ig:user:<username>` for Instagram-first accounts. */
  const { googleSub, profile: profileData, tokens } = body;

  if (!googleSub || typeof googleSub !== 'string') {
    return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  }

  const ok = await upsertProfile(
    googleSub,
    profileData ?? {},
    tokens ?? {},
    profileData?.googleIdentity?.email,
    profileData?.name,
  );

  // Compute and store the identity graph (preserve LLM inference subtree if present)
  if (ok && profileData) {
    try {
      const existing = await getProfile(googleSub);
      const priorInference = existing?.identity_graph?.inferenceIdentity;
      const priorIntelligence = existing?.identity_graph?.identityIntelligence;
      const priorSnapshot = existing?.identity_graph?.identitySnapshot;
      const priorHyperInference = existing?.identity_graph?.hyperInference;
      const priorMemoryGraph = existing?.identity_graph?.memoryGraph;
      const priorIdentitySynthesis = existing?.identity_graph?.identitySynthesis;
      const priorExpressionLayer = existing?.identity_graph?.expressionLayer;
      const priorExpressionFeedback = existing?.identity_graph?.expressionFeedback;
      const manualInterestTags = await getManualInterestTags(googleSub);
      const forGraph = {
        ...profileData,
        ...(manualInterestTags.length ? { manualInterestTags } : {}),
      };
      const signalMeter = buildSignalMeter(forGraph);
      const graph = buildIdentityGraph({ ...forGraph, signalMeter });
      const summary = identitySummary(graph);
      const graphRecord: Record<string, unknown> = {
        ...(graph as unknown as Record<string, unknown>),
        ...(priorInference ? { inferenceIdentity: priorInference } : {}),
        ...(priorIntelligence ? { identityIntelligence: priorIntelligence } : {}),
        ...(priorSnapshot ? { identitySnapshot: priorSnapshot } : {}),
        ...(priorHyperInference ? { hyperInference: priorHyperInference } : {}),
        ...(priorMemoryGraph ? { memoryGraph: priorMemoryGraph } : {}),
        ...(priorIdentitySynthesis ? { identitySynthesis: priorIdentitySynthesis } : {}),
        ...(priorExpressionLayer ? { expressionLayer: priorExpressionLayer } : {}),
        ...(priorExpressionFeedback ? { expressionFeedback: priorExpressionFeedback } : {}),
      };
      await upsertIdentityGraph(googleSub, graphRecord, summary);
    } catch (e) {
      console.error('[ProfileSave] Identity graph build error:', e);
    }
  }

  return json({ ok });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';
import { buildRecencyContext } from '$lib/server/marketplace/buildRecencyContext';
import { runIdentityIntelligenceFromInputs } from '$lib/server/marketplace/inferIdentityIntelligence';
import {
  parseIdentityIntelligenceWrapper,
} from '$lib/server/marketplace/identityIntelligenceSchema';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';
import { getManualInterestTags, getProfile, isSupabaseConfigured, upsertIdentityGraph } from '$lib/server/supabase';
import { buildSignalMeter } from '$lib/server/signalMeter';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { googleSub?: unknown; userQuery?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const userQuery =
    typeof body.userQuery === 'string' && body.userQuery.trim() ? body.userQuery.trim() : undefined;
  const force = body.force === true;

  if (!googleSub) return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });

  const row = await getProfile(googleSub);
  if (!row) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const profileData = row.profile_data as Record<string, unknown>;
  const manualInterestTags = await getManualInterestTags(googleSub);
  const merged: Record<string, unknown> = {
    ...profileData,
    ...(manualInterestTags.length ? { manualInterestTags } : {}),
  };

  const priorFullGraph = (row.identity_graph ?? {}) as Record<string, unknown>;
  const cached = parseIdentityIntelligenceWrapper(priorFullGraph.identityIntelligence);

  if (!userQuery && !force) {
    return json({
      ok: true,
      fromCache: true,
      identityIntelligence: cached,
    });
  }

  const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
  if (!keyOk) {
    return json({ ok: false, error: 'anthropic_not_configured' }, { status: 503 });
  }

  const signalMeter = buildSignalMeter(merged);
  const graph = buildIdentityGraph({ ...merged, signalMeter });
  const summaryStr = identitySummary(graph);
  const base = graph as unknown as Record<string, unknown>;
  const inferenceWrap = parseInferenceIdentityWrapper(priorFullGraph.inferenceIdentity);

  const recency = buildRecencyContext({
    profileData: merged,
    updatedPlatformKeys: [],
  });

  const intel = await runIdentityIntelligenceFromInputs({
    graph,
    identitySummary: summaryStr,
    inferenceCurrent: inferenceWrap?.current ?? null,
    recencyContext: recency,
    userQuery,
  });

  if (!intel) {
    return json({
      ok: false,
      error: 'intelligence_failed',
      identityIntelligence: cached,
    }, { status: 502 });
  }

  const graphData: Record<string, unknown> = { ...base };
  if (priorFullGraph.inferenceIdentity != null) {
    graphData.inferenceIdentity = priorFullGraph.inferenceIdentity;
  }
  graphData.identityIntelligence = intel;

  const saved = await upsertIdentityGraph(googleSub, graphData, summaryStr);
  if (!saved) {
    return json({ ok: false, error: 'persist_failed' }, { status: 500 });
  }

  return json({
    ok: true,
    fromCache: false,
    identityIntelligence: intel,
  });
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { runBrandMemberBrief } from '$lib/server/marketplace/inferBrandMemberBrief';
import { getManualInterestTags, getProfile, isSupabaseConfigured } from '$lib/server/supabase';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';
import { buildRecencyContext } from '$lib/server/marketplace/buildRecencyContext';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';
import { parseIdentityIntelligenceWrapper } from '$lib/server/marketplace/identityIntelligenceSchema';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    user_google_sub?: unknown;
    actorGoogleSub?: unknown;
    match_reason?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  assertBrandAccess(request, typeof body.actorGoogleSub === 'string' ? body.actorGoogleSub : null);

  const sub = typeof body.user_google_sub === 'string' ? body.user_google_sub.trim() : '';
  if (!sub) {
    throw error(400, 'user_google_sub is required');
  }

  const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
  if (!keyOk) {
    return json({ ok: false, error: 'anthropic_not_configured' }, { status: 503 });
  }

  const row = await getProfile(sub);
  if (!row) {
    throw error(404, 'Profile not found');
  }

  const profileData = row.profile_data as Record<string, unknown>;
  const manualInterestTags = await getManualInterestTags(sub);
  const merged: Record<string, unknown> = {
    ...profileData,
    ...(manualInterestTags.length ? { manualInterestTags } : {}),
  };

  const graph = buildIdentityGraph(merged);
  const summaryStr = identitySummary(graph);
  const priorGraph = (row.identity_graph ?? {}) as Record<string, unknown>;
  const inferenceWrap = parseInferenceIdentityWrapper(priorGraph.inferenceIdentity);
  const intelWrap = parseIdentityIntelligenceWrapper(priorGraph.identityIntelligence);

  const recency = buildRecencyContext({
    profileData: merged,
    updatedPlatformKeys: [],
  });

  const matchReason =
    typeof body.match_reason === 'string' && body.match_reason.trim()
      ? body.match_reason.trim()
      : undefined;

  const brief = await runBrandMemberBrief({
    graph,
    identitySummary: summaryStr,
    inferenceCurrent: inferenceWrap?.current ?? null,
    intelligencePayload: intelWrap?.payload ?? null,
    recencyContext: recency,
    matchReasonFromBrand: matchReason,
  });

  if (!brief) {
    return json({ ok: false, error: 'brief_failed' }, { status: 502 });
  }

  return json({ ok: true, brief });
};

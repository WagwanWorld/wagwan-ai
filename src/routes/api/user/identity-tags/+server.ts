import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { flattenIdentityGraph } from '$lib/server/marketplace/identityGraphTags';
import { parseIdentityIntelligenceWrapper } from '$lib/server/marketplace/identityIntelligenceSchema';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  }

  const row = await getProfile(sub.trim());
  const graph = (row?.identity_graph ?? {}) as Record<string, unknown>;
  const fromGraph = flattenIdentityGraph(graph).slice(0, 40);

  const sb = getServiceSupabase();
  const { data: prefs } = await sb
    .from('user_marketing_prefs')
    .select('manual_interest_tags')
    .eq('user_google_sub', sub.trim())
    .maybeSingle();

  const manual = Array.isArray(prefs?.manual_interest_tags)
    ? (prefs!.manual_interest_tags as string[]).filter(Boolean)
    : [];

  const inferenceFull = parseInferenceIdentityWrapper(graph.inferenceIdentity);
  const inference = inferenceFull
    ? {
        ...inferenceFull,
        history: inferenceFull.history.slice(-8),
      }
    : null;

  const identityIntelligence = parseIdentityIntelligenceWrapper(graph.identityIntelligence);

  return json({
    ok: true,
    tags: [...new Set([...fromGraph, ...manual.map(t => t.toLowerCase())])].slice(0, 50),
    manual_interest_tags: manual,
    inference,
    identityIntelligence,
  });
};

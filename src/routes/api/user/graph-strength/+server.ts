import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, isSupabaseConfigured } from '$lib/server/supabase';
import { computeGraphStrength } from '$lib/server/marketplace/graphStrength';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  }

  const row = await getProfile(sub.trim());
  if (!row) {
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const graph = (row.identity_graph as Record<string, unknown>) ?? {};
  const profileData = (row.profile_data as Record<string, unknown>) ?? {};
  const detail = computeGraphStrength(graph, profileData, row.updated_at);

  return json({
    ok: true,
    ...detail,
    updated_at: row.updated_at,
  });
};

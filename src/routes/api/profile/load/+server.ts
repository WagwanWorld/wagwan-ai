import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, isSupabaseConfigured } from '$lib/server/supabase';
import { graphStaleForRow } from '$lib/server/graphStaleness';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub) {
    return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  }

  const row = await getProfile(sub);
  if (!row) {
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const { stale: graphStale, maxAgeDays: graphMaxAgeDays, lastActivityAt: graphLastActivityAt } =
    graphStaleForRow(row);

  return json({
    ok: true,
    profile: row.profile_data,
    updatedAt: row.updated_at,
    graphStale,
    graphMaxAgeDays,
    graphLastActivityAt,
  });
};

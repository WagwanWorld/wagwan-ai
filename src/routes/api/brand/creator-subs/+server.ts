import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';

export const GET: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const igUserId = assertBrandAccess(request);
  if (!igUserId) {
    return json({ ok: false, error: 'brand_access_denied' }, { status: 401 });
  }

  const sb = getServiceSupabase();
  const { data: rows } = await sb.from('user_profiles').select('google_sub').limit(50);

  const targets = (rows ?? [])
    .filter((r) => r.google_sub)
    .map((r) => ({
      user_google_sub: r.google_sub as string,
      match_score: 50,
      match_reason: 'Targeted via quick brief',
    }));

  return json({ ok: true, targets });
};

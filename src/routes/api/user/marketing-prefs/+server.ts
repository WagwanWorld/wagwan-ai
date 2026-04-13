import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data } = await sb
    .from('user_marketing_prefs')
    .select('*')
    .eq('user_google_sub', sub.trim())
    .maybeSingle();

  return json({
    ok: true,
    prefs: data ?? null,
  });
};

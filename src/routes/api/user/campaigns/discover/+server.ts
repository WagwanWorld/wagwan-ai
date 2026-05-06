import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'sub is required');

  const sb = getServiceSupabase();

  const { data: targeted } = await sb
    .from('campaign_audience')
    .select('campaign_id')
    .eq('user_google_sub', sub);

  const targetedIds = (targeted ?? []).map((r) => r.campaign_id);

  let query = sb
    .from('campaigns')
    .select('id, brand_name, title, creative_text, reward_inr, channels, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20);

  if (targetedIds.length > 0) {
    query = query.not('id', 'in', `(${targetedIds.join(',')})`);
  }

  const { data: campaigns, error: qErr } = await query;

  if (qErr) {
    return json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  return json({ ok: true, campaigns: campaigns ?? [] });
};

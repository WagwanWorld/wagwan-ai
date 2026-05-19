import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const campaignId = params.id;
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'sub is required');

  const sb = getServiceSupabase();

  const { data: campaign, error: cErr } = await sb
    .from('campaigns')
    .select('id, brand_name, title, creative_text, reward_inr, channels, status, created_at')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) {
    return json({ ok: false, error: 'campaign_not_found' }, { status: 404 });
  }

  const { data: briefRows } = await sb
    .from('brief_responses')
    .select('status, ig_post_url, accepted_at, completed_at, payout_inr')
    .eq('campaign_id', campaignId)
    .eq('user_google_sub', sub)
    .limit(1);

  const briefResponse = briefRows?.[0] ?? null;

  const { data: matchRows } = await sb
    .from('campaign_audience')
    .select('match_score, match_reason')
    .eq('campaign_id', campaignId)
    .eq('user_google_sub', sub)
    .limit(1);

  const match = matchRows?.[0] ?? null;

  const { data: creatives } = await sb
    .from('brief_assets')
    .select('id, campaign_id, media_type, url, thumb_url, caption, sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true });

  return json({ ok: true, campaign, briefResponse, match, creatives: creatives ?? [] });
};

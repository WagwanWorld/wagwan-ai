import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

type CampaignEmbed = {
  id: string;
  brand_name: string;
  title: string;
  creative_text: string;
  channels: { email?: boolean; in_app?: boolean };
  reward_inr: number;
  status: string;
  created_at: string;
};

function normalizeCampaignEmbed(raw: unknown): CampaignEmbed | null {
  if (!raw) return null;
  const o = (Array.isArray(raw) ? raw[0] : raw) as CampaignEmbed | null;
  if (!o || typeof o !== 'object' || !('id' in o)) return null;
  return o;
}

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    throw error(400, 'sub is required');
  }

  const sb = getServiceSupabase();
  const { data, error: qErr } = await sb
    .from('campaign_audience')
    .select(
      `
      match_score,
      match_reason,
      campaign_id,
      campaigns ( id, brand_name, title, creative_text, channels, reward_inr, status, created_at )
    `,
    )
    .eq('user_google_sub', sub.trim());

  if (qErr) {
    console.error('[user/campaigns]', qErr.message);
    throw error(500, 'Database error');
  }

  const rows = (data ?? []) as {
    match_score: number;
    match_reason: string;
    campaign_id: string;
    campaigns: unknown;
  }[];

  const cards = rows
    .map(r => {
      const c = normalizeCampaignEmbed(r.campaigns);
      return { r, c };
    })
    .filter(({ c }) => c?.status === 'active')
    .map(({ r, c }) => {
      return {
        campaign_id: c!.id,
        brand_name: c!.brand_name,
        title: c!.title,
        creative_text: c!.creative_text,
        channels: c!.channels,
        reward_inr: c!.reward_inr,
        match_reason: r.match_reason,
        match_score: r.match_score,
        created_at: c!.created_at,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return json({ ok: true, campaigns: cards });
};

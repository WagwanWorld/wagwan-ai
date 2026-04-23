import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import type { BriefStatus } from '$lib/server/creatorMarketplace';

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

/**
 * GET /api/user/campaigns?sub=<google_sub>&status=<csv>
 *
 * Source of truth for the creator inbox. Joins campaign_audience to
 * brief_responses so each card carries its per-creator brief_status
 * (sent | accepted | live | completed | declined). By default we surface
 * everything except 'declined' so the list reflects what the creator still
 * has in their pipeline. Pass `status=completed` (or any csv) for history
 * views.
 */
export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    throw error(400, 'sub is required');
  }

  const statusParam = url.searchParams.get('status')?.trim();
  const requestedStatuses = statusParam
    ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as BriefStatus[])
    : null;

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

  if (rows.length === 0) return json({ ok: true, campaigns: [] });

  const campaignIds = [...new Set(rows.map((r) => r.campaign_id))];
  const { data: briefRows } = await sb
    .from('brief_responses')
    .select('campaign_id, status, ig_post_url, accepted_at, live_at, completed_at')
    .eq('user_google_sub', sub.trim())
    .in('campaign_id', campaignIds);

  const briefByCampaign = new Map<
    string,
    {
      status: BriefStatus;
      ig_post_url: string | null;
      accepted_at: string | null;
      live_at: string | null;
      completed_at: string | null;
    }
  >();
  for (const b of briefRows ?? []) {
    briefByCampaign.set(b.campaign_id as string, {
      status: (b.status as BriefStatus) ?? 'sent',
      ig_post_url: (b.ig_post_url as string | null) ?? null,
      accepted_at: (b.accepted_at as string | null) ?? null,
      live_at: (b.live_at as string | null) ?? null,
      completed_at: (b.completed_at as string | null) ?? null,
    });
  }

  // Default inbox view = everything the creator still has action on, i.e.
  // anything that isn't declined.
  const defaultVisible: BriefStatus[] = ['sent', 'accepted', 'live', 'completed'];
  const visibleStatuses = new Set<BriefStatus>(requestedStatuses ?? defaultVisible);

  const cards = rows
    .map((r) => {
      const c = normalizeCampaignEmbed(r.campaigns);
      const brief = briefByCampaign.get(r.campaign_id) ?? {
        status: 'sent' as BriefStatus,
        ig_post_url: null,
        accepted_at: null,
        live_at: null,
        completed_at: null,
      };
      return { r, c, brief };
    })
    .filter(({ c, brief }) => c?.status === 'active' && visibleStatuses.has(brief.status))
    .map(({ r, c, brief }) => ({
      campaign_id: c!.id,
      brand_name: c!.brand_name,
      title: c!.title,
      creative_text: c!.creative_text,
      channels: c!.channels,
      reward_inr: c!.reward_inr,
      match_reason: r.match_reason,
      match_score: r.match_score,
      created_at: c!.created_at,
      brief_status: brief.status,
      ig_post_url: brief.ig_post_url,
      accepted_at: brief.accepted_at,
      live_at: brief.live_at,
      completed_at: brief.completed_at,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return json({ ok: true, campaigns: cards });
};

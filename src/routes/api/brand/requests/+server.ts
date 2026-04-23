import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { markBriefLive } from '$lib/server/creatorMarketplace';

/**
 * GET /api/brand/requests
 *   -> { ok, campaigns: [{ id, title, status, created_at, reward_inr, counts, members }] }
 *
 * PATCH /api/brand/requests
 *   body: { campaignId: uuid, action: 'mark_live' | 'mark_completed' | 'close', userSub?: string }
 *
 * Source of truth for the brand portal "Requests" panel. Joins campaigns ->
 * brief_responses (per creator) so the UI can show sent / accepted /
 * declined / live / completed funnels.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const brandIgUserId = assertBrandAccess(request, null);
  const sb = getServiceSupabase();

  let brand_id: string | null = null;
  if (brandIgUserId) {
    const { data } = await sb
      .from('brand_accounts')
      .select('brand_id')
      .eq('ig_user_id', brandIgUserId)
      .maybeSingle();
    brand_id = (data?.brand_id as string | null) ?? null;
  }

  if (!brand_id) {
    return json({ ok: true, campaigns: [] });
  }

  const { data: campaigns, error: campErr } = await sb
    .from('campaigns')
    .select('id, title, status, created_at, reward_inr, brand_name')
    .eq('brand_id', brand_id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (campErr) {
    console.error('[brand/requests] campaigns select', campErr.message);
    throw error(500, 'Could not load campaigns');
  }

  const ids = (campaigns ?? []).map((c) => c.id as string);
  if (ids.length === 0) return json({ ok: true, campaigns: [] });

  const { data: briefs, error: briefErr } = await sb
    .from('brief_responses')
    .select('campaign_id, user_google_sub, status, accepted_at, live_at, completed_at, ig_post_url')
    .in('campaign_id', ids);

  if (briefErr) {
    console.error('[brand/requests] briefs select', briefErr.message);
    throw error(500, 'Could not load requests');
  }

  const byCampaign = new Map<
    string,
    {
      counts: Record<string, number>;
      members: Array<{
        user_google_sub: string;
        status: string;
        accepted_at: string | null;
        live_at: string | null;
        completed_at: string | null;
        ig_post_url: string | null;
      }>;
    }
  >();
  for (const id of ids) {
    byCampaign.set(id, {
      counts: { sent: 0, accepted: 0, declined: 0, live: 0, completed: 0 },
      members: [],
    });
  }
  for (const b of briefs ?? []) {
    const entry = byCampaign.get(b.campaign_id as string);
    if (!entry) continue;
    const status = String(b.status ?? 'sent');
    entry.counts[status] = (entry.counts[status] ?? 0) + 1;
    entry.members.push({
      user_google_sub: b.user_google_sub as string,
      status,
      accepted_at: (b.accepted_at as string | null) ?? null,
      live_at: (b.live_at as string | null) ?? null,
      completed_at: (b.completed_at as string | null) ?? null,
      ig_post_url: (b.ig_post_url as string | null) ?? null,
    });
  }

  const out = (campaigns ?? []).map((c) => {
    const entry = byCampaign.get(c.id as string)!;
    return {
      id: c.id as string,
      title: c.title as string,
      status: c.status as string,
      created_at: c.created_at as string,
      reward_inr: Number(c.reward_inr ?? 0),
      counts: entry.counts,
      members: entry.members,
    };
  });

  return json({ ok: true, campaigns: out });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  const brandIgUserId = assertBrandAccess(request, null);

  const body = await request.json().catch(() => null);
  const campaignId = String(body?.campaignId ?? '').trim();
  const action = String(body?.action ?? '').trim();
  const userSub =
    typeof body?.userSub === 'string' && body.userSub.trim() ? body.userSub.trim() : null;

  if (!UUID_RE.test(campaignId)) {
    return json({ ok: false, error: 'invalid_campaign_id' }, { status: 400 });
  }

  const sb = getServiceSupabase();

  // Ownership check: campaign must belong to the brand behind the session.
  let brand_id: string | null = null;
  if (brandIgUserId) {
    const { data } = await sb
      .from('brand_accounts')
      .select('brand_id')
      .eq('ig_user_id', brandIgUserId)
      .maybeSingle();
    brand_id = (data?.brand_id as string | null) ?? null;
  }
  if (!brand_id) return json({ ok: false, error: 'brand_not_linked' }, { status: 403 });

  const { data: camp } = await sb
    .from('campaigns')
    .select('id, brand_id, status')
    .eq('id', campaignId)
    .maybeSingle();
  if (!camp || camp.brand_id !== brand_id) {
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (action === 'mark_live') {
    const n = await markBriefLive(campaignId, userSub ?? undefined);
    return json({ ok: true, updated: n });
  }

  if (action === 'close') {
    const { error: updErr } = await sb
      .from('campaigns')
      .update({ status: 'ended' })
      .eq('id', campaignId);
    if (updErr) {
      console.error('[brand/requests] close campaign', updErr.message);
      return json({ ok: false, error: 'close_failed' }, { status: 500 });
    }
    return json({ ok: true });
  }

  return json({ ok: false, error: 'invalid_action' }, { status: 400 });
};

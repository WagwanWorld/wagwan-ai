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
      .select('brand_id, ig_username, ig_name')
      .eq('ig_user_id', brandIgUserId)
      .maybeSingle();
    brand_id = (data?.brand_id as string | null) ?? null;

    // Auto-link brand_id if missing (e.g. account created before this fix)
    if (!brand_id && data) {
      const brandName = (data.ig_name as string) || (data.ig_username as string) || 'Brand';
      const { data: newBrand } = await sb
        .from('brands')
        .insert({ name: brandName })
        .select('id')
        .single();
      if (newBrand?.id) {
        brand_id = newBrand.id as string;
        await sb.from('brand_accounts').update({ brand_id }).eq('ig_user_id', brandIgUserId);
      }
    }
  }

  if (!brand_id) {
    return json({ ok: true, campaigns: [] });
  }

  const { data: campaigns, error: campErr } = await sb
    .from('campaigns')
    .select('id, title, creative_text, status, created_at, reward_inr, brand_name')
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

  const { data: creativeRows } = await sb
    .from('brief_assets')
    .select('id, campaign_id, media_type, url, thumb_url, caption, sort_order')
    .in('campaign_id', ids)
    .order('sort_order', { ascending: true });

  const creativesByCampaign = new Map<string, Array<Record<string, unknown>>>();
  for (const row of creativeRows ?? []) {
    const campaignId = row.campaign_id as string;
    const list = creativesByCampaign.get(campaignId) ?? [];
    list.push({
      id: row.id,
      media_type: row.media_type,
      url: row.url,
      thumb_url: row.thumb_url,
      caption: row.caption,
      sort_order: row.sort_order,
    });
    creativesByCampaign.set(campaignId, list);
  }

  // Resolve creator names
  const allSubs = [
    ...new Set((briefs ?? []).map((b) => b.user_google_sub as string).filter(Boolean)),
  ];
  const nameMap = new Map<string, string>();
  if (allSubs.length > 0) {
    const { data: profiles } = await sb
      .from('user_profiles')
      .select('google_sub, name')
      .in('google_sub', allSubs);
    for (const p of profiles ?? []) {
      if (p.name) nameMap.set(p.google_sub as string, p.name as string);
    }
  }

  const byCampaign = new Map<
    string,
    {
      counts: Record<string, number>;
      members: Array<{
        user_google_sub: string;
        name: string;
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
      name: nameMap.get(b.user_google_sub as string) || '',
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
      creative_text: (c.creative_text as string) ?? '',
      brand_name: (c.brand_name as string) ?? 'Brand',
      status: c.status as string,
      created_at: c.created_at as string,
      reward_inr: Number(c.reward_inr ?? 0),
      counts: entry.counts,
      members: entry.members,
      creatives: creativesByCampaign.get(c.id as string) ?? [],
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

  if (action === 'update') {
    const updates: Record<string, unknown> = {};
    if (typeof body?.title === 'string' && body.title.trim()) updates.title = body.title.trim();
    if (body?.reward_inr != null && Number.isFinite(Number(body.reward_inr)))
      updates.reward_inr = Number(body.reward_inr);
    if (Object.keys(updates).length === 0)
      return json({ ok: false, error: 'nothing_to_update' }, { status: 400 });
    const { error: updErr } = await sb.from('campaigns').update(updates).eq('id', campaignId);
    if (updErr) {
      console.error('[brand/requests] update campaign', updErr.message);
      return json({ ok: false, error: 'update_failed' }, { status: 500 });
    }
    return json({ ok: true });
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

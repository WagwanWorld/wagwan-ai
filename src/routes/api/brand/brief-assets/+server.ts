import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { normalizeBriefAssets } from '$lib/server/marketplace/briefAssets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveBrandId(igUserId: string): Promise<string | null> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('brand_accounts')
    .select('brand_id')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  return (data?.brand_id as string | null) ?? null;
}

async function assertCampaignOwnership(campaignId: string, brandId: string): Promise<void> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('campaigns')
    .select('id, brand_id')
    .eq('id', campaignId)
    .maybeSingle();
  if (!data || data.brand_id !== brandId) {
    throw error(404, 'campaign_not_found');
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const brandId = await resolveBrandId(igUserId);
  if (!brandId) throw error(403, 'brand_not_linked');

  const body = await request.json().catch(() => null);
  const campaignId = String(body?.campaignId ?? '').trim();
  if (!UUID_RE.test(campaignId)) throw error(400, 'invalid_campaign_id');

  const creatives = normalizeBriefAssets(body?.creatives);
  if (!creatives.length) throw error(400, 'creatives_required');

  await assertCampaignOwnership(campaignId, brandId);

  const rows = creatives.map((asset, idx) => ({
    campaign_id: campaignId,
    brand_id: brandId,
    media_type: asset.mediaType,
    url: asset.url,
    gcs_path: asset.gcsPath,
    thumb_url: asset.thumbUrl ?? null,
    caption: asset.caption ?? '',
    sort_order: asset.sortOrder ?? idx,
    metadata: asset.metadata ?? {},
  }));

  const sb = getServiceSupabase();
  const { data, error: insErr } = await sb
    .from('brief_assets')
    .insert(rows)
    .select(
      'id, campaign_id, media_type, url, gcs_path, thumb_url, caption, sort_order, created_at',
    )
    .order('sort_order', { ascending: true });
  if (insErr) throw error(500, insErr.message);

  return json({ ok: true, creatives: data ?? [] });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');
  const brandId = await resolveBrandId(igUserId);
  if (!brandId) throw error(403, 'brand_not_linked');

  const body = await request.json().catch(() => null);
  const campaignId = String(body?.campaignId ?? '').trim();
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (!UUID_RE.test(campaignId)) throw error(400, 'invalid_campaign_id');
  await assertCampaignOwnership(campaignId, brandId);

  const sb = getServiceSupabase();
  for (const raw of updates) {
    const assetId = String(raw?.assetId ?? '').trim();
    if (!UUID_RE.test(assetId)) continue;
    const patch: Record<string, unknown> = {};
    if (Number.isFinite(Number(raw?.sortOrder))) patch.sort_order = Number(raw.sortOrder);
    if (typeof raw?.caption === 'string') patch.caption = raw.caption.slice(0, 280);
    if (!Object.keys(patch).length) continue;
    const { error: updErr } = await sb
      .from('brief_assets')
      .update(patch)
      .eq('id', assetId)
      .eq('campaign_id', campaignId)
      .eq('brand_id', brandId);
    if (updErr) throw error(500, updErr.message);
  }

  const { data, error: listErr } = await sb
    .from('brief_assets')
    .select(
      'id, campaign_id, media_type, url, gcs_path, thumb_url, caption, sort_order, created_at',
    )
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true });
  if (listErr) throw error(500, listErr.message);

  return json({ ok: true, creatives: data ?? [] });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');
  const brandId = await resolveBrandId(igUserId);
  if (!brandId) throw error(403, 'brand_not_linked');

  const body = await request.json().catch(() => null);
  const campaignId = String(body?.campaignId ?? '').trim();
  const assetId = String(body?.assetId ?? '').trim();
  if (!UUID_RE.test(campaignId) || !UUID_RE.test(assetId)) throw error(400, 'invalid_payload');
  await assertCampaignOwnership(campaignId, brandId);

  const sb = getServiceSupabase();
  const { error: delErr } = await sb
    .from('brief_assets')
    .delete()
    .eq('id', assetId)
    .eq('campaign_id', campaignId)
    .eq('brand_id', brandId);
  if (delErr) throw error(500, delErr.message);

  return json({ ok: true });
};

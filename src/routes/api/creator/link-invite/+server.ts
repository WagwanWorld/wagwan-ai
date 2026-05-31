import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireCreatorProfileSub } from '$lib/server/creatorAuth';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const requestedGoogleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();
  const googleSub = await requireCreatorProfileSub(request, sb, requestedGoogleSub);

  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  if (rosterId) {
    const { data: rosterRow, error: rosterError } = await sb
      .from('brand_creator_roster')
      .select('analysis_snapshot, invite_message, user_google_sub')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (rosterError) {
      console.error('[creator/link-invite] roster lookup failed:', rosterError.message);
      throw error(500, 'roster lookup failed');
    }
    if (!rosterRow) {
      throw error(404, 'roster entry not found');
    }

    const linkedSub = typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub : '';
    if (linkedSub && linkedSub !== googleSub) {
      throw error(409, 'roster entry already linked');
    }

    const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
    fitLabel = (analysis?.fitLabel as string) ?? null;
    fitScore = (analysis?.fitScore as number) ?? null;
    inviteMessage = (rosterRow.invite_message as string) ?? null;
    analysisSnapshot = analysis ?? {};

    const { error: updateError } = await sb
      .from('brand_creator_roster')
      .update({
        status: 'on_platform',
        user_google_sub: googleSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .or(`user_google_sub.is.null,user_google_sub.eq.${googleSub}`);
    if (updateError) {
      console.error('[creator/link-invite] roster update failed:', updateError.message);
      throw error(500, 'roster update failed');
    }
  }

  const { data: account } = await sb
    .from('brand_accounts')
    .select('ig_username, ig_name, ig_profile_picture')
    .eq('brand_id', brandId)
    .limit(1)
    .maybeSingle();

  const { data: brandRow } = await sb.from('brands').select('name').eq('id', brandId).maybeSingle();

  const brandName = account?.ig_name?.trim() || brandRow?.name || 'Brand';
  const brandHandle = account?.ig_username || null;
  const brandProfilePicture = account?.ig_profile_picture || null;

  const signal = await upsertCreatorBrandSignal(sb, {
    creator_google_sub: googleSub,
    signal_type: 'roster_add',
    brand_id: brandId,
    roster_entry_id: rosterId ?? null,
    brand_name: brandName,
    brand_handle: brandHandle,
    brand_profile_picture: brandProfilePicture,
    invite_message: inviteMessage,
    fit_label: fitLabel,
    fit_score: fitScore,
    analysis_snapshot: analysisSnapshot,
  });
  if (!signal) {
    throw error(500, 'creator signal upsert failed');
  }

  return json({ ok: true });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { assertCreatorAccount } from '$lib/server/creatorAuth';
import { fetchInstagramProfile } from '$lib/server/instagram';

type RosterInviteRow = {
  ig_username?: string | null;
  analysis_snapshot?: unknown;
  invite_message?: unknown;
};

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  await assertCreatorAccount(request, googleSub, body);
  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();
  let rosterRow: RosterInviteRow | null = null;

  // 1. Update roster entry if it exists: mark as on_platform, link google_sub
  if (rosterId) {
    const { data } = await sb
      .from('brand_creator_roster')
      .select('ig_username, analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (!data) throw error(404, 'Roster invite not found');
    rosterRow = data as RosterInviteRow;

    const instagramToken =
      typeof body.instagramToken === 'string' ? body.instagramToken.trim() : '';
    if (!instagramToken) throw error(401, 'Instagram authentication required');

    let instagramUsername = '';
    try {
      const instagramProfile = await fetchInstagramProfile(instagramToken);
      instagramUsername = instagramProfile.username?.trim().toLowerCase() ?? '';
    } catch {
      throw error(401, 'Invalid Instagram token');
    }

    const rosterUsername = rosterRow?.ig_username?.trim().toLowerCase() ?? '';
    if (!instagramUsername || instagramUsername !== rosterUsername) {
      throw error(403, 'Creator does not match roster invite');
    }

    const { error: updateError } = await sb
      .from('brand_creator_roster')
      .update({
        status: 'on_platform',
        user_google_sub: googleSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId)
      .eq('brand_id', brandId);
    if (updateError) throw error(500, 'Could not link roster invite');
  }

  // 2. Look up brand context for the signal
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

  // 3. Pull fit data from roster entry if available
  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  if (rosterId) {
    if (rosterRow) {
      const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
      fitLabel = (analysis?.fitLabel as string) ?? null;
      fitScore = (analysis?.fitScore as number) ?? null;
      inviteMessage = (rosterRow.invite_message as string) ?? null;
      analysisSnapshot = analysis ?? {};
    }
  }

  // 4. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
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

  return json({ ok: true });
};

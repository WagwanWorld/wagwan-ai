import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';
import {
  getProfileInstagramUsername,
  normalizeCreatorInstagramUsername,
} from '$lib/server/creatorIdentity';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : '';

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();
  const creator = await requireAuthenticatedCreator(sb, request);
  const creatorUsername = getProfileInstagramUsername(creator.profileData);
  if (!creatorUsername) throw error(403, 'creator_instagram_not_linked');

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .maybeSingle();

  if (rosterErr) {
    console.error('[creator link-invite] roster lookup failed:', rosterErr.message);
    throw error(500, 'roster_lookup_failed');
  }
  if (!rosterRow) {
    throw error(404, 'roster_invite_not_found');
  }
  if (normalizeCreatorInstagramUsername(rosterRow.ig_username) !== creatorUsername) {
    throw error(403, 'creator_does_not_match_invite');
  }

  const { data: updatedRow, error: updateErr } = await sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: creator.googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .select('analysis_snapshot, invite_message')
    .maybeSingle();

  if (updateErr) {
    console.error('[creator link-invite] roster update failed:', updateErr.message);
    throw error(500, 'roster_update_failed');
  }
  if (!updatedRow) {
    throw error(409, 'roster_invite_already_claimed');
  }

  // 1. Look up brand context for the signal
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

  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  const analysisSnapshot = (updatedRow.analysis_snapshot ?? {}) as Record<string, unknown>;
  fitLabel = (analysisSnapshot.fitLabel as string) ?? null;
  fitScore = (analysisSnapshot.fitScore as number) ?? null;
  const inviteMessage = (updatedRow.invite_message as string) ?? null;

  // 2. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
    creator_google_sub: creator.googleSub,
    signal_type: 'roster_add',
    brand_id: brandId,
    roster_entry_id: rosterId,
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

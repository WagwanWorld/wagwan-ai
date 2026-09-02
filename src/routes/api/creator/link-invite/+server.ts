import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreatorProfile } from '$lib/server/creatorAuth';
import {
  getProfileInstagramUsername,
  normalizeInstagramUsername,
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
  const profile = await requireAuthenticatedCreatorProfile(request, sb);
  const creatorUsername = getProfileInstagramUsername(profile.profile_data);
  if (!creatorUsername) throw error(403, 'creator_instagram_not_linked');

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, status, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterErr) {
    console.error('[creator/link-invite] roster lookup', rosterErr.message);
    throw error(500, 'roster_lookup_failed');
  }
  if (!rosterRow) {
    throw error(404, 'roster_invite_not_found');
  }
  if (rosterRow.status !== 'prospect' || rosterRow.user_google_sub) {
    throw error(409, 'roster_invite_already_claimed');
  }
  if (normalizeInstagramUsername(rosterRow.ig_username) !== creatorUsername) {
    throw error(403, 'creator_instagram_mismatch');
  }

  const { data: updatedRoster, error: updateErr } = await sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: profile.google_sub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .select('id')
    .maybeSingle();

  if (updateErr) {
    console.error('[creator/link-invite] roster claim', updateErr.message);
    throw error(500, 'roster_claim_failed');
  }
  if (!updatedRoster) {
    throw error(409, 'roster_invite_already_claimed');
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

  // 3. Pull fit data from the verified roster entry
  const analysisSnapshot = (rosterRow.analysis_snapshot as Record<string, unknown> | null) ?? {};
  const fitLabel = (analysisSnapshot.fitLabel as string) ?? null;
  const fitScore = (analysisSnapshot.fitScore as number) ?? null;
  const inviteMessage = (rosterRow.invite_message as string) ?? null;

  // 4. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
    creator_google_sub: profile.google_sub,
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

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';
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
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();
  const { googleSub, profile } = await requireAuthenticatedCreator(request);
  const creatorInstagram = getProfileInstagramUsername(profile);
  if (!creatorInstagram) throw error(403, 'Creator Instagram account is not linked');

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .maybeSingle();

  if (rosterError) {
    throw error(500, 'Could not verify invite');
  }

  if (!rosterRow || normalizeInstagramUsername(rosterRow.ig_username) !== creatorInstagram) {
    throw error(403, 'Invite does not belong to this creator');
  }

  const { data: claimedRows, error: claimError } = await sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .select('id');

  if (claimError) {
    throw error(500, 'Could not claim invite');
  }

  if (!claimedRows?.[0]) {
    throw error(403, 'Invite does not belong to this creator');
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

  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  const analysisSnapshot = rosterRow.analysis_snapshot ?? {};
  fitLabel = (analysisSnapshot.fitLabel as string) ?? null;
  fitScore = (analysisSnapshot.fitScore as number) ?? null;

  // 4. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
    creator_google_sub: googleSub,
    signal_type: 'roster_add',
    brand_id: brandId,
    roster_entry_id: rosterId,
    brand_name: brandName,
    brand_handle: brandHandle,
    brand_profile_picture: brandProfilePicture,
    invite_message: rosterRow.invite_message,
    fit_label: fitLabel,
    fit_score: fitScore,
    analysis_snapshot: analysisSnapshot,
  });

  return json({ ok: true });
};

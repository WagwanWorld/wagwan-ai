import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { normalizeInstagramUsername, resolveAuthenticatedCreator } from '$lib/server/creatorAuth';
import { isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();
  const creator = await resolveAuthenticatedCreator(sb, request);
  if (!creator) {
    return json({ ok: false, error: 'invalid_or_unlinked_creator_token' }, { status: 401 });
  }

  // 1. Verify the invite belongs to the authenticated creator, then claim it.
  const { data: rosterRow } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (!rosterRow) {
    return json({ ok: false, error: 'invite_not_found' }, { status: 404 });
  }

  const rosterUsername = normalizeInstagramUsername(rosterRow.ig_username);
  if (!creator.instagramUsername || creator.instagramUsername !== rosterUsername) {
    return json({ ok: false, error: 'invite_creator_mismatch' }, { status: 403 });
  }

  const { error: rosterUpdateError } = await sb
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
    .select('id')
    .single();

  if (rosterUpdateError) {
    return json({ ok: false, error: 'invite_already_claimed' }, { status: 409 });
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

  // 3. Pull fit data from the verified roster entry.
  const analysisSnapshot = (rosterRow.analysis_snapshot as Record<string, unknown> | null) ?? {};
  const fitLabel = (analysisSnapshot.fitLabel as string) ?? null;
  const fitScore = (analysisSnapshot.fitScore as number) ?? null;
  const inviteMessage = (rosterRow.invite_message as string) ?? null;

  // 4. Upsert the signal
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

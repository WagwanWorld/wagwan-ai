import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { profileMatchesRosterInstagram } from '$lib/server/creatorLinkInvite';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!googleSub) throw error(400, 'googleSub is required');
  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, analysis_snapshot, invite_message, status, user_google_sub')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterError) {
    console.error('[creator/link-invite] roster lookup failed:', rosterError.message);
    return json({ ok: false, error: 'roster_lookup_failed' }, { status: 500 });
  }
  if (!rosterRow) {
    return json({ ok: false, error: 'roster_not_found' }, { status: 404 });
  }
  if (rosterRow.user_google_sub && rosterRow.user_google_sub !== googleSub) {
    return json({ ok: false, error: 'roster_already_linked' }, { status: 409 });
  }

  const { data: profileRow, error: profileError } = await sb
    .from('user_profiles')
    .select('profile_data')
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (profileError) {
    console.error('[creator/link-invite] profile lookup failed:', profileError.message);
    return json({ ok: false, error: 'profile_lookup_failed' }, { status: 500 });
  }
  if (!profileRow) {
    return json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }
  if (!profileMatchesRosterInstagram(profileRow.profile_data, rosterRow.ig_username as string)) {
    return json({ ok: false, error: 'instagram_mismatch' }, { status: 403 });
  }

  // Look up brand context for the signal
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

  // Pull fit data from the verified roster entry.
  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  if (rosterRow) {
    const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
    fitLabel = (analysis?.fitLabel as string) ?? null;
    fitScore = (analysis?.fitScore as number) ?? null;
    inviteMessage = (rosterRow.invite_message as string) ?? null;
    analysisSnapshot = analysis ?? {};
  }

  // Mark the invite as claimed only after validating the creator.
  if (rosterRow.user_google_sub !== googleSub) {
    const { data: updatedRow, error: updateError } = await sb
      .from('brand_creator_roster')
      .update({
        status: 'on_platform',
        user_google_sub: googleSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .is('user_google_sub', null)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('[creator/link-invite] roster update failed:', updateError.message);
      return json({ ok: false, error: 'roster_update_failed' }, { status: 500 });
    }
    if (!updatedRow) {
      return json({ ok: false, error: 'roster_already_linked' }, { status: 409 });
    }
  }

  const signal = await upsertCreatorBrandSignal(sb, {
    creator_google_sub: googleSub,
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
  if (!signal) {
    return json({ ok: false, error: 'signal_upsert_failed' }, { status: 500 });
  }

  return json({ ok: true });
};

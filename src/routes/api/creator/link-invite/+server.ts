import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { validateCreatorInviteLink } from '$lib/server/creatorLinkInvite';
import { fetchInstagramProfile } from '$lib/server/instagram';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!googleSub) throw error(400, 'googleSub is required');
  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();

  const { data: profileRow, error: profileError } = await sb
    .from('user_profiles')
    .select('platform_tokens')
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (profileError) {
    console.error('[creator/link-invite] profile lookup failed:', profileError.message);
    return json({ ok: false, error: 'profile_lookup_failed' }, { status: 500 });
  }
  if (!profileRow) {
    return json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }
  const tokens = (profileRow.platform_tokens ?? {}) as Record<string, unknown>;
  const instagramToken =
    typeof tokens.instagramToken === 'string' && tokens.instagramToken.trim()
      ? tokens.instagramToken.trim()
      : '';
  if (!instagramToken) {
    return json({ ok: false, error: 'instagram_token_missing' }, { status: 409 });
  }

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, user_google_sub, analysis_snapshot, invite_message')
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

  let verifiedInstagramUsername = '';
  try {
    const instagramProfile = await fetchInstagramProfile(instagramToken);
    verifiedInstagramUsername = instagramProfile.username;
  } catch (e) {
    console.error(
      '[creator/link-invite] instagram verification failed:',
      e instanceof Error ? e.message : e,
    );
    return json({ ok: false, error: 'instagram_verification_failed' }, { status: 409 });
  }

  const validation = validateCreatorInviteLink({
    creatorGoogleSub: googleSub,
    creatorProfileData: { instagramIdentity: { username: verifiedInstagramUsername } },
    rosterIgUsername: String(rosterRow.ig_username ?? ''),
    rosterUserGoogleSub:
      typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub : null,
  });
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, { status: 409 });
  }

  // Mark only the matching, still-unclaimed roster row as on-platform.
  const updateQuery = sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId);

  if (rosterRow.user_google_sub) {
    updateQuery.eq('user_google_sub', googleSub);
  } else {
    updateQuery.is('user_google_sub', null);
  }

  const { data: updatedRoster, error: updateError } = await updateQuery.select('id').maybeSingle();
  if (updateError) {
    console.error('[creator/link-invite] roster update failed:', updateError.message);
    return json({ ok: false, error: 'roster_update_failed' }, { status: 500 });
  }
  if (!updatedRoster) {
    return json({ ok: false, error: 'roster_already_linked' }, { status: 409 });
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

  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
  inviteMessage = (rosterRow.invite_message as string) ?? null;
  analysisSnapshot = analysis ?? {};

  // 4. Upsert the signal
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

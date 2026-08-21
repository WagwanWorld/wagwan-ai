import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { getAuthenticatedCreator } from '$lib/server/creatorAuth';
import { normalizeInstagramUsername } from '$lib/server/creatorIdentity';

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
  const auth = await getAuthenticatedCreator(sb, request);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.creator.instagramUsername) {
    return json({ ok: false, error: 'creator_instagram_required' }, { status: 403 });
  }

  // 1. Claim only the exact unclaimed invite row for this authenticated creator.
  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, status, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterError) {
    console.error('[creator/link-invite] roster lookup failed:', rosterError.message);
    return json({ ok: false, error: 'roster_lookup_failed' }, { status: 500 });
  }
  if (!rosterRow) {
    return json({ ok: false, error: 'invite_not_found' }, { status: 404 });
  }

  const rosterUsername = normalizeInstagramUsername(rosterRow.ig_username);
  if (!rosterUsername || rosterUsername !== auth.creator.instagramUsername) {
    return json({ ok: false, error: 'invite_creator_mismatch' }, { status: 403 });
  }
  if (rosterRow.status !== 'prospect' || rosterRow.user_google_sub) {
    return json({ ok: false, error: 'invite_already_claimed' }, { status: 409 });
  }

  const { data: claimedRow, error: claimError } = await sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: auth.creator.googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error('[creator/link-invite] roster claim failed:', claimError.message);
    return json({ ok: false, error: 'invite_claim_failed' }, { status: 500 });
  }
  if (!claimedRow) {
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
  await upsertCreatorBrandSignal(sb, {
    creator_google_sub: auth.creator.googleSub,
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

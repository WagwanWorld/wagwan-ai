import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';
import { profileOwnsInstagramHandle } from '$lib/server/creatorProfileOwnership';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');

  const { googleSub, profile } = await requireAuthenticatedCreator(request);
  const sb = getServiceSupabase();

  let rosterRow: {
    analysis_snapshot: Record<string, unknown> | null;
    invite_message: string | null;
    ig_username: string | null;
    status: string | null;
    user_google_sub: string | null;
  } | null = null;

  // 1. Update roster entry if it exists: mark as on_platform, link google_sub
  if (rosterId) {
    const { data: existingRoster, error: rosterLookupError } = await sb
      .from('brand_creator_roster')
      .select('analysis_snapshot, invite_message, ig_username, status, user_google_sub')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (rosterLookupError) {
      console.error('[link-invite] roster lookup failed:', rosterLookupError.message);
      throw error(500, 'roster_lookup_failed');
    }
    if (!existingRoster) throw error(404, 'roster_entry_not_found');
    if (!profileOwnsInstagramHandle(profile, existingRoster.ig_username)) {
      throw error(403, 'invite_creator_mismatch');
    }

    rosterRow = existingRoster;

    if (existingRoster.user_google_sub && existingRoster.user_google_sub !== googleSub) {
      throw error(409, 'invite_already_linked');
    }

    if (!existingRoster.user_google_sub) {
      if (existingRoster.status !== 'prospect') {
        throw error(409, 'invite_already_linked');
      }

      const { data: updatedRoster, error: rosterUpdateError } = await sb
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
        .select('analysis_snapshot, invite_message, ig_username, status, user_google_sub')
        .maybeSingle();

      if (rosterUpdateError) {
        console.error('[link-invite] roster update failed:', rosterUpdateError.message);
        throw error(500, 'roster_update_failed');
      }
      if (!updatedRoster) {
        throw error(409, 'invite_already_linked');
      }

      rosterRow = updatedRoster;
    }
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

  if (rosterRow) {
    const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
    fitLabel = (analysis?.fitLabel as string) ?? null;
    fitScore = (analysis?.fitScore as number) ?? null;
    inviteMessage = (rosterRow.invite_message as string) ?? null;
    analysisSnapshot = analysis ?? {};
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

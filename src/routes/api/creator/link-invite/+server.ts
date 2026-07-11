import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { getAuthenticatedCreator, instagramUsernamesMatch } from '$lib/server/creatorAuth';

type RosterInviteRow = {
  id: string;
  ig_username: string;
  user_google_sub: string | null;
  status: string | null;
  analysis_snapshot: Record<string, unknown> | null;
  invite_message: string | null;
};

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const creator = await getAuthenticatedCreator(request);
  if (!creator.ok) {
    return json({ ok: false, error: creator.error }, { status: creator.status });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;
  const requestedSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';

  if (requestedSub && requestedSub !== creator.googleSub) {
    throw error(403, 'Cannot link another creator');
  }
  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();
  let rosterRow: RosterInviteRow | null = null;

  // 1. Update roster entry if it exists and belongs to this creator's Instagram account.
  if (rosterId) {
    const { data: existingRoster, error: rosterFetchError } = await sb
      .from('brand_creator_roster')
      .select('id, ig_username, user_google_sub, status, analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (rosterFetchError) {
      console.error('[creator/link-invite] roster lookup failed:', rosterFetchError.message);
      return json({ ok: false, error: 'roster_lookup_failed' }, { status: 500 });
    }
    if (!existingRoster) {
      throw error(404, 'Roster invite not found');
    }
    if (!instagramUsernamesMatch(creator.instagramUsername, existingRoster.ig_username)) {
      throw error(403, 'Invite does not match authenticated creator');
    }
    if (existingRoster.user_google_sub && existingRoster.user_google_sub !== creator.googleSub) {
      throw error(409, 'Roster invite already linked');
    }

    rosterRow = existingRoster as RosterInviteRow;

    if (!existingRoster.user_google_sub) {
      const { data: updatedRoster, error: rosterUpdateError } = await sb
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
        .select('id, ig_username, user_google_sub, status, analysis_snapshot, invite_message')
        .maybeSingle();

      if (rosterUpdateError) {
        console.error('[creator/link-invite] roster update failed:', rosterUpdateError.message);
        return json({ ok: false, error: 'roster_update_failed' }, { status: 500 });
      }
      if (!updatedRoster) {
        throw error(409, 'Roster invite could not be linked');
      }
      rosterRow = updatedRoster as RosterInviteRow;
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
  const signal = await upsertCreatorBrandSignal(sb, {
    creator_google_sub: creator.googleSub,
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
    return json({ ok: false, error: 'signal_upsert_failed' }, { status: 500 });
  }

  return json({ ok: true });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { doesProfileMatchRosterHandle } from '$lib/utils/creatorIdentity';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const creator = await requireAuthenticatedCreator(request);

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : '';

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, status, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterErr || !rosterRow) {
    throw error(404, 'Invite not found');
  }

  if (
    !doesProfileMatchRosterHandle(
      creator.profile.profile_data ?? {},
      String(rosterRow.ig_username ?? ''),
    )
  ) {
    throw error(403, 'Invite does not match authenticated creator');
  }

  const currentLinkedSub =
    typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub.trim() : '';
  if (currentLinkedSub && currentLinkedSub !== creator.googleSub) {
    throw error(409, 'Invite has already been claimed');
  }

  // 1. Mark the matching unclaimed roster entry as on-platform.
  if (!currentLinkedSub) {
    const { data: claimed, error: claimErr } = await sb
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
      .maybeSingle();

    if (claimErr || !claimed) {
      throw error(409, 'Invite has already been claimed');
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

  // 3. Pull fit data from the verified roster entry.
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

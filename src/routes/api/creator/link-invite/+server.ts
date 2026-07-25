import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { getCreatorInstagramUsername, requireCreatorProfile } from '$lib/server/creatorAuth';

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
  const creatorProfile = await requireCreatorProfile(request);
  const googleSub = creatorProfile.google_sub;
  const creatorIgUsername = getCreatorInstagramUsername(creatorProfile);
  if (!creatorIgUsername) throw error(400, 'Creator Instagram is required');

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, status, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterError) throw error(500, 'Could not load invite');
  if (!rosterRow) throw error(404, 'Invite not found');

  const rosterUsername = String(rosterRow.ig_username ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (rosterUsername !== creatorIgUsername) {
    throw error(403, 'Invite does not belong to this creator');
  }

  const linkedGoogleSub =
    typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub.trim() : '';
  if (linkedGoogleSub && linkedGoogleSub !== googleSub) {
    throw error(409, 'Invite already claimed');
  }

  if (!linkedGoogleSub) {
    if (rosterRow.status !== 'prospect') {
      throw error(409, 'Invite is not claimable');
    }

    const { data: claimedRow, error: updateError } = await sb
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
      .select('id')
      .maybeSingle();

    if (updateError) throw error(500, 'Could not claim invite');
    if (!claimedRow) throw error(409, 'Invite already claimed');
  }

  // Look up brand context for the signal.
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

  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
  inviteMessage = (rosterRow.invite_message as string) ?? null;
  analysisSnapshot = analysis ?? {};

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

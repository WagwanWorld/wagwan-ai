import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';
import { getProfileInstagramUsername } from '$lib/server/creatorIdentity';
import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : '';

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const { googleSub, profile } = await requireAuthenticatedCreator(request);
  const creatorHandle = getProfileInstagramUsername(profile.profile_data);
  if (!creatorHandle) {
    throw error(403, 'Authenticated creator profile is missing Instagram identity');
  }

  const sb = getServiceSupabase();

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .maybeSingle();

  if (rosterError) {
    console.error('[link-invite] roster lookup failed:', rosterError.message);
    throw error(500, 'Could not verify invite');
  }
  if (!rosterRow) throw error(404, 'Invite not found or already claimed');

  const rosterHandle = normalizeIgHandle(String(rosterRow.ig_username ?? ''));
  if (!rosterHandle || rosterHandle !== creatorHandle) {
    throw error(403, 'Invite does not belong to authenticated creator');
  }

  const { data: updatedRow, error: updateError } = await sb
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

  if (updateError) {
    console.error('[link-invite] roster claim failed:', updateError.message);
    throw error(500, 'Could not claim invite');
  }
  if (!updatedRow) throw error(409, 'Invite was already claimed');

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
  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
  inviteMessage = (rosterRow.invite_message as string) ?? null;
  const analysisSnapshot = analysis ?? {};

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

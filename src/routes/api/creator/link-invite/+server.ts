import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { getAuthenticatedCreator } from '$lib/server/creatorAuth';
import { creatorInstagramMatchesRoster } from '$lib/server/creatorIdentity';
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
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : '';

  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');

  const sb = getServiceSupabase();
  const creator = await getAuthenticatedCreator(sb, request);
  if (!creator) {
    return json({ ok: false, error: 'invalid_or_unlinked_token' }, { status: 401 });
  }

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, status, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterErr || !rosterRow) {
    throw error(404, 'Invite not found');
  }
  if (!creatorInstagramMatchesRoster(creator.profileData, rosterRow.ig_username)) {
    throw error(403, 'Invite does not belong to this creator');
  }
  if (rosterRow.status !== 'prospect' || rosterRow.user_google_sub) {
    throw error(409, 'Invite already claimed');
  }

  // Claim exactly one still-unclaimed prospect row. The predicates keep racing claims from
  // overwriting a creator already linked by another request.
  const { data: claimedRow, error: claimErr } = await sb
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

  if (claimErr || !claimedRow) {
    throw error(409, 'Invite already claimed');
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
  let inviteMessage: string | null = (rosterRow.invite_message as string) ?? null;
  let analysisSnapshot: Record<string, unknown> = {};

  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
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

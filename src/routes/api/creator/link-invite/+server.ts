import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import {
  IG_ACCOUNT_PROOF_COOKIE,
  normalizeInstagramUsername,
  verifyInstagramAccountProof,
} from '$lib/server/marketplace/accountProof';

export const POST: RequestHandler = async ({ request, cookies }) => {
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

  const cookieSecret = env.COOKIE_SECRET?.trim();
  if (!cookieSecret) throw error(503, 'Creator authentication not configured');

  const proof = verifyInstagramAccountProof(cookies.get(IG_ACCOUNT_PROOF_COOKIE), cookieSecret);
  if (!proof) throw error(401, 'Instagram account proof is required');

  const sb = getServiceSupabase();

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, user_google_sub, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterErr) {
    console.error('[creator/link-invite] roster lookup failed:', rosterErr.message);
    throw error(500, 'Could not load invite');
  }
  if (!rosterRow) throw error(404, 'Invite not found');

  const rosterUsername = normalizeInstagramUsername(rosterRow.ig_username as string | null);
  if (!rosterUsername || rosterUsername !== proof.username) {
    throw error(403, 'Invite does not match connected Instagram account');
  }

  const existingSub =
    typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub : '';
  if (existingSub && existingSub !== googleSub) {
    throw error(409, 'Invite has already been linked');
  }

  // 1. Claim the roster entry atomically so a forwarded invite cannot overwrite an existing link.
  let updateQuery = sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId);

  updateQuery = existingSub
    ? updateQuery.eq('user_google_sub', googleSub)
    : updateQuery.is('user_google_sub', null);

  const { data: updatedRow, error: updateErr } = await updateQuery
    .select('analysis_snapshot, invite_message')
    .maybeSingle();

  if (updateErr) {
    console.error('[creator/link-invite] roster update failed:', updateErr.message);
    throw error(500, 'Could not link invite');
  }
  if (!updatedRow) throw error(409, 'Invite has already been linked');

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

  const analysis = updatedRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
  inviteMessage = (updatedRow.invite_message as string) ?? null;
  analysisSnapshot = analysis ?? {};

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

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { requireAuthenticatedCreatorProfile } from '$lib/server/creatorAuth';
import { extractCreatorInstagramUsername } from '$lib/server/creatorIdentity';
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

  const sb = getServiceSupabase();
  const creator = await requireAuthenticatedCreatorProfile(sb, request);
  const creatorInstagram = extractCreatorInstagramUsername(creator.profileData);
  if (!creatorInstagram) {
    throw error(403, 'Creator Instagram profile required');
  }

  const { data: rosterRow, error: rosterErr } = await sb
    .from('brand_creator_roster')
    .select('id, ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .eq('status', 'prospect')
    .is('user_google_sub', null)
    .maybeSingle();

  if (rosterErr) {
    console.error('[creator-link-invite] roster lookup failed:', rosterErr.message);
    throw error(500, 'Could not verify invite');
  }
  if (!rosterRow) {
    throw error(404, 'Invite not found');
  }
  if (normalizeIgHandle(String(rosterRow.ig_username ?? '')) !== creatorInstagram) {
    throw error(403, 'Invite does not match creator');
  }

  const { data: updatedRoster, error: updateErr } = await sb
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

  if (updateErr) {
    console.error('[creator-link-invite] roster update failed:', updateErr.message);
    throw error(500, 'Could not claim invite');
  }
  if (!updatedRoster) {
    throw error(409, 'Invite already claimed');
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

  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  fitLabel = (analysis?.fitLabel as string) ?? null;
  fitScore = (analysis?.fitScore as number) ?? null;
  inviteMessage = (rosterRow.invite_message as string) ?? null;
  analysisSnapshot = analysis ?? {};

  // Upsert the signal for the authenticated creator only.
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

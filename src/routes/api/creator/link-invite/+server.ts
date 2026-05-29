import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { fetchInstagramProfile } from '$lib/server/instagram';
import {
  normalizeInstagramHandle,
  profileMatchesInstagram,
} from '$lib/server/creatorInviteLinkAuth';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : '';
  const instagramToken = typeof body.instagramToken === 'string' ? body.instagramToken.trim() : '';

  if (!googleSub) throw error(400, 'googleSub is required');
  if (!brandId) throw error(400, 'brandId is required');
  if (!rosterId) throw error(400, 'rosterId is required');
  if (!instagramToken) throw error(401, 'instagramToken is required');

  const sb = getServiceSupabase();

  const { data: rosterRow, error: rosterError } = await sb
    .from('brand_creator_roster')
    .select('id, brand_id, ig_username, analysis_snapshot, invite_message')
    .eq('id', rosterId)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (rosterError || !rosterRow) {
    throw error(404, 'Roster invite not found');
  }

  let igProfile: Awaited<ReturnType<typeof fetchInstagramProfile>>;
  try {
    igProfile = await fetchInstagramProfile(instagramToken);
  } catch {
    throw error(401, 'Invalid Instagram token');
  }

  if (
    normalizeInstagramHandle(rosterRow.ig_username as string) !==
    normalizeInstagramHandle(igProfile.username)
  ) {
    throw error(403, 'Instagram account does not match this invite');
  }

  if (!(await profileMatchesInstagram(sb, googleSub, igProfile))) {
    throw error(403, 'Creator profile does not match Instagram account');
  }

  // 1. Update the verified roster entry: mark as on_platform, link google_sub.
  await sb
    .from('brand_creator_roster')
    .update({
      status: 'on_platform',
      user_google_sub: googleSub,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rosterId)
    .eq('brand_id', brandId);

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

  // 3. Pull fit data from the verified roster entry
  const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
  const fitLabel = (analysis?.fitLabel as string) ?? null;
  const fitScore = (analysis?.fitScore as number) ?? null;
  const inviteMessage = (rosterRow.invite_message as string) ?? null;
  const analysisSnapshot = analysis ?? {};

  // 4. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
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

  return json({ ok: true });
};

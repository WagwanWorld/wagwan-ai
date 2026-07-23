import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import {
  normalizeInstagramUsername,
  requireAuthenticatedCreatorProfile,
} from '$lib/server/creatorAuth';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();
  const creator = await requireAuthenticatedCreatorProfile(request, sb);

  // 1. Look up brand context for the signal
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

  // 2. Pull and validate roster fit data if available
  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  if (rosterId) {
    const { data: rosterRow, error: rosterErr } = await sb
      .from('brand_creator_roster')
      .select('ig_username, user_google_sub, status, analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (rosterErr) {
      console.error('[creator/link-invite] roster lookup failed:', rosterErr.message);
      throw error(500, 'Could not link invite');
    }
    if (!rosterRow) {
      throw error(404, 'Roster entry not found');
    }

    const rosterHandle = normalizeInstagramUsername(rosterRow.ig_username);
    if (!creator.instagramUsername || rosterHandle !== creator.instagramUsername) {
      throw error(403, 'Invite does not belong to this creator');
    }

    const linkedSub =
      typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub.trim() : '';
    if (linkedSub && linkedSub !== creator.googleSub) {
      throw error(409, 'Invite already linked');
    }

    if (!linkedSub && rosterRow.status === 'prospect') {
      const { data: updated, error: updateErr } = await sb
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

      if (updateErr || !updated) {
        if (updateErr) {
          console.error('[creator/link-invite] roster update failed:', updateErr.message);
        }
        throw error(updateErr ? 500 : 409, 'Could not link invite');
      }
    }

    if (rosterRow) {
      const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
      fitLabel = (analysis?.fitLabel as string) ?? null;
      fitScore = (analysis?.fitScore as number) ?? null;
      inviteMessage = (rosterRow.invite_message as string) ?? null;
      analysisSnapshot = analysis ?? {};
    }
  }

  // 3. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
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

  return json({ ok: true });
};

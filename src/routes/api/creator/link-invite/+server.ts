import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
import { creatorMatchesRosterInstagram, requireCreatorProfile } from '$lib/server/creatorAuth';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const auth = await requireCreatorProfile(request);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const googleSub = auth.profile.google_sub;
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();

  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  // 1. Update roster entry if it exists: mark as on_platform, link google_sub
  if (rosterId) {
    const { data: rosterRow, error: rosterError } = await sb
      .from('brand_creator_roster')
      .select('ig_username, status, user_google_sub, analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .eq('brand_id', brandId)
      .maybeSingle();

    if (rosterError) {
      console.error('[creator/link-invite] roster lookup failed:', rosterError.message);
      return json({ ok: false, error: 'roster_lookup_failed' }, { status: 500 });
    }
    if (!rosterRow) {
      return json({ ok: false, error: 'roster_not_found' }, { status: 404 });
    }

    if (!creatorMatchesRosterInstagram(auth.profile, rosterRow.ig_username)) {
      return json({ ok: false, error: 'instagram_identity_mismatch' }, { status: 403 });
    }

    const linkedGoogleSub =
      typeof rosterRow.user_google_sub === 'string' ? rosterRow.user_google_sub.trim() : '';
    if (linkedGoogleSub && linkedGoogleSub !== googleSub) {
      return json({ ok: false, error: 'roster_already_linked' }, { status: 409 });
    }

    if (!linkedGoogleSub) {
      const { data: updated, error: updateError } = await sb
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
        console.error('[creator/link-invite] roster update failed:', updateError.message);
        return json({ ok: false, error: 'roster_update_failed' }, { status: 500 });
      }
      if (!updated) {
        return json({ ok: false, error: 'roster_not_linkable' }, { status: 409 });
      }
    }

    const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
    fitLabel = (analysis?.fitLabel as string) ?? null;
    fitScore = (analysis?.fitScore as number) ?? null;
    inviteMessage = (rosterRow.invite_message as string) ?? null;
    analysisSnapshot = analysis ?? {};
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

  // 3. Upsert the signal
  const signal = await upsertCreatorBrandSignal(sb, {
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

  if (!signal) {
    return json({ ok: false, error: 'signal_upsert_failed' }, { status: 500 });
  }

  return json({ ok: true });
};

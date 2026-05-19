import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!googleSub) throw error(400, 'googleSub is required');
  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();

  // 1. Update roster entry if it exists: mark as on_platform, link google_sub
  if (rosterId) {
    await sb
      .from('brand_creator_roster')
      .update({
        status: 'on_platform',
        user_google_sub: googleSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId)
      .eq('brand_id', brandId);
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

  if (rosterId) {
    const { data: rosterRow } = await sb
      .from('brand_creator_roster')
      .select('analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .maybeSingle();

    if (rosterRow) {
      const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
      fitLabel = (analysis?.fitLabel as string) ?? null;
      fitScore = (analysis?.fitScore as number) ?? null;
      inviteMessage = (rosterRow.invite_message as string) ?? null;
      analysisSnapshot = analysis ?? {};
    }
  }

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

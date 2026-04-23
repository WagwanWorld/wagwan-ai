import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { googleSub?: string; campaignId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const sub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';

  if (!sub || !campaignId) {
    throw error(400, 'googleSub and campaignId are required');
  }

  if (!['view', 'save', 'dismiss', 'click'].includes(action)) {
    throw error(400, 'action must be view, save, dismiss, or click');
  }

  const sb = getServiceSupabase();

  const { error: insErr } = await sb.from('campaign_interactions').insert({
    user_google_sub: sub,
    campaign_id: campaignId,
    action,
  });

  if (insErr) {
    console.error('[user/campaign-interaction]', insErr.message);
    throw error(500, 'Log failed');
  }

  // NOTE: Earnings are credited exclusively on brief completion via
  // creatorMarketplace.completeBrief. The old "25% of click" simulation was
  // removed to avoid double-crediting and to align the wallet ledger with the
  // real brand → creator state machine.

  return json({ ok: true });
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { settlePendingEarnings } from '$lib/server/creatorMarketplace';

/**
 * POST /api/user/wallet/settle
 *   Authorization: Bearer <CRON_SECRET>
 *   body: { googleSub: string, minAgeSeconds?: number }
 *
 * Simulated settlement sink: moves rows from `user_earnings.status='pending'`
 * to `'available'` for the user. Stand-in for a real payments/settlement
 * webhook so dev + demos can walk the full state machine end-to-end. Intended
 * to be driven by a cron (e.g. `vercel cron`) or a manual dev call.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    googleSub?: string;
    minAgeSeconds?: number;
  };

  const sub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!sub) throw error(400, 'googleSub is required');

  const minAge = Math.max(0, Number(body.minAgeSeconds ?? 0));
  const updated = await settlePendingEarnings(sub, minAge);

  return json({ ok: true, simulated: true, updated });
};

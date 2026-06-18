import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { settlePendingEarnings } from '$lib/server/creatorMarketplace';
import { authorizeUserSubjectMutation } from '$lib/server/userSubjectAccess';

/**
 * POST /api/user/wallet/settle
 *   body: { googleSub: string, minAgeSeconds?: number }
 *   headers: Authorization: Bearer <wagwan-access-token>
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

  const body = (await request.json().catch(() => ({}))) as {
    googleSub?: string;
    minAgeSeconds?: number;
  };

  const sub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!sub) throw error(400, 'googleSub is required');

  const access = await authorizeUserSubjectMutation(request, sub);
  if (!access.ok) {
    return json({ ok: false, error: access.error }, { status: access.status });
  }

  const minAge = Math.max(0, Number(body.minAgeSeconds ?? 0));
  const updated = await settlePendingEarnings(sub, minAge);

  return json({ ok: true, simulated: true, updated });
};

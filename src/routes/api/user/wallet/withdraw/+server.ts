import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { withdrawAvailableEarnings } from '$lib/server/creatorMarketplace';
import { authorizeUserGoogleSub } from '$lib/server/userMutationAuth';

/**
 * POST /api/user/wallet/withdraw
 *   body: { googleSub: string }
 *
 * Simulated payout. Moves every `user_earnings` row currently in 'available'
 * to 'withdrawn' and returns the total. There is no real UPI payout yet — the
 * simulated:true flag is the contract the UI uses to render a "simulated"
 * banner next to the success message.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { googleSub?: string };
  const sub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!sub) throw error(400, 'googleSub is required');

  const auth = await authorizeUserGoogleSub(request, sub);
  if (!auth.ok) {
    return json(
      {
        ok: false,
        error: auth.error,
        ...(auth.message ? { message: auth.message } : {}),
      },
      { status: auth.status },
    );
  }

  const { amount, rowIds } = await withdrawAvailableEarnings(auth.googleSub);

  if (amount <= 0) {
    return json(
      {
        ok: false,
        error: 'no_available_balance',
        message:
          'Nothing available to withdraw yet. Complete a brief, then settle your pending balance.',
      },
      { status: 400 },
    );
  }

  return json({
    ok: true,
    simulated: true,
    withdrawn_inr: amount,
    rows: rowIds.length,
    message: `Simulated payout · ₹${amount.toLocaleString('en-IN')} marked as withdrawn.`,
  });
};

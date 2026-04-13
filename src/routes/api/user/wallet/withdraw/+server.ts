import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** UPI / payouts not wired yet — stable contract for the app. */
export const POST: RequestHandler = async () => {
  return json(
    {
      ok: false,
      error: 'withdraw_not_available',
      message: 'Withdrawals via UPI are coming soon. Totals below are simulated.',
    },
    { status: 501 },
  );
};

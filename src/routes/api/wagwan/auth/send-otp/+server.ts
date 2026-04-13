import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateOTP } from '$lib/server/wagwanGrpc';

/**
 * POST /api/wagwan/auth/send-otp
 * Body: { "phone": "+91XXXXXXXXXX" }
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { phone?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  try {
    await generateOTP(phone);
    return json({ ok: true });
  } catch (err: any) {
    const msg = err?.details || err?.message || 'otp_send_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};

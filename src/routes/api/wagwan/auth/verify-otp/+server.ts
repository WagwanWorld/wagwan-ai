import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyLoginOTP } from '$lib/server/wagwanGrpc';

/**
 * POST /api/wagwan/auth/verify-otp
 * Body: { "phone": "+91XXXXXXXXXX", "otp": "123456" }
 */
export const POST: RequestHandler = async ({ request }) => {
  let body: { phone?: unknown; otp?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }
  if (!otp || otp.length !== 6) {
    return json({ ok: false, error: 'invalid_otp' }, { status: 400 });
  }

  try {
    const tokens = await verifyLoginOTP(phone, otp);
    return json({ ok: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err: any) {
    const msg = err?.details || err?.message || 'otp_verify_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};

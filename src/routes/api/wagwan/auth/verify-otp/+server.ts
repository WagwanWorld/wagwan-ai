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

  // #region agent log
  {
    const phoneOk =
      !!phone && phone.length === 13 && phone.startsWith('+');
    const otpOk = !!otp && otp.length === 6;
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'verify-otp/+server.ts:validate',
        message: 'verify-otp gates',
        data: {
          phoneLen: phone.length,
          phoneOk,
          otpLen: otp.length,
          otpOk,
          hypothesisId: 'H1',
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
  }
  // #endregion
  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }
  if (!otp || otp.length !== 6) {
    return json({ ok: false, error: 'invalid_otp' }, { status: 400 });
  }

  try {
    const tokens = await verifyLoginOTP(phone, otp);
    // #region agent log
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'verify-otp/+server.ts:tokens',
        message: 'verifyLoginOTP resolved',
        data: {
          hasAccess: !!tokens.accessToken?.length,
          hasRefresh: !!tokens.refreshToken?.length,
          hypothesisId: 'H4',
        },
        timestamp: Date.now(),
        hypothesisId: 'H4',
      }),
    }).catch(() => {});
    // #endregion
    return json({ ok: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'verify-otp/+server.ts:verifyErr',
        message: 'verifyLoginOTP rejected',
        data: {
          grpcCode: err?.code,
          grpcMsg: typeof err?.message === 'string' ? err.message.slice(0, 200) : 'unknown',
          hypothesisId: 'H3',
        },
        timestamp: Date.now(),
        hypothesisId: 'H3',
      }),
    }).catch(() => {});
    // #endregion
    const msg = err?.details || err?.message || 'otp_verify_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};

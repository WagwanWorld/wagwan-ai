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
  // #region agent log
  {
    const passes =
      !!phone && phone.length === 13 && phone.startsWith('+');
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'send-otp/+server.ts:validate',
        message: 'send-otp phone gate',
        data: { phoneLen: phone.length, passesLen13Plus: passes, hypothesisId: 'H1' },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
  }
  // #endregion
  if (!phone || phone.length !== 13 || !phone.startsWith('+')) {
    return json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  try {
    await generateOTP(phone);
    // #region agent log
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'send-otp/+server.ts:generateOK',
        message: 'generateOTP resolved',
        data: { hypothesisId: 'H2' },
        timestamp: Date.now(),
        hypothesisId: 'H2',
      }),
    }).catch(() => {});
    // #endregion
    return json({ ok: true });
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7721/ingest/6ef978aa-320b-4ec5-8158-741a3200d0f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '30df21' },
      body: JSON.stringify({
        sessionId: '30df21',
        location: 'send-otp/+server.ts:generateErr',
        message: 'generateOTP rejected',
        data: {
          grpcCode: err?.code,
          grpcMsg: typeof err?.message === 'string' ? err.message.slice(0, 200) : 'unknown',
          hypothesisId: 'H2',
        },
        timestamp: Date.now(),
        hypothesisId: 'H2',
      }),
    }).catch(() => {});
    // #endregion
    const msg = err?.details || err?.message || 'otp_send_failed';
    return json({ ok: false, error: msg }, { status: 502 });
  }
};

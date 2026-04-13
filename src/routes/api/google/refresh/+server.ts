import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refreshGoogleToken } from '$lib/server/google';

export const POST: RequestHandler = async ({ request }) => {
  const { refreshToken } = await request.json();
  if (!refreshToken) return json({ ok: false }, { status: 400 });
  try {
    const accessToken = await refreshGoogleToken(refreshToken);
    return json({ ok: true, accessToken });
  } catch (e) {
    console.error('[Token refresh]', e);
    return json({ ok: false, error: 'refresh_failed' }, { status: 401 });
  }
};

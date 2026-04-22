import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BRAND_SESSION_COOKIE } from '$lib/server/marketplace/brandSession';

export const POST: RequestHandler = async ({ cookies }) => {
  // Delete with the same options used when setting
  cookies.delete(BRAND_SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  });
  return json({ ok: true });
};

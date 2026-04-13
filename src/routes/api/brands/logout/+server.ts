import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BRAND_SESSION_COOKIE } from '$lib/server/marketplace/brandSession';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete(BRAND_SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
};

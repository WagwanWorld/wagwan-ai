import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrandInstagramAuthUrl } from '$lib/server/marketplace/brandInstagram';
import { INSTAGRAM_APP_ID } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ cookies }) => {
  if (!INSTAGRAM_APP_ID?.trim()) {
    throw redirect(302, '/brands/login?error=not_configured');
  }
  const state = crypto.randomUUID();
  cookies.set('brand_ig_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: cookieSecure,
  });
  throw redirect(302, getBrandInstagramAuthUrl(state));
};

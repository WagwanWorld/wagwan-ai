import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrandInstagramAuthUrl } from '$lib/server/marketplace/brandInstagram';
import { INSTAGRAM_APP_ID } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { signOAuthState } from '$lib/server/marketplace/oauthState';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ cookies }) => {
  if (!INSTAGRAM_APP_ID?.trim()) {
    throw redirect(302, '/?error=not_configured');
  }
  const nonce = crypto.randomUUID();
  // Sign the state so the callback can verify it without relying on a cookie.
  // Safari ITP can drop cookies set in a 302 redirect response, breaking OAuth.
  const state = signOAuthState(nonce);

  // Still set the cookie as a secondary check for browsers that support it
  cookies.set('brand_ig_oauth_state', nonce, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: cookieSecure,
  });
  throw redirect(302, getBrandInstagramAuthUrl(state));
};

/**
 * GET /auth/instagram
 * Initiates the Instagram OAuth flow.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstagramAuthUrl } from '$lib/server/instagram';
import { INSTAGRAM_APP_ID } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { signOAuthState } from '$lib/server/marketplace/oauthState';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ cookies, url }) => {
  const from = url.searchParams.get('from') ?? 'onboarding';
  if (!INSTAGRAM_APP_ID?.trim()) {
    const dest =
      from === 'join'
        ? '/'
        : from === 'landing'
          ? '/'
          : from === 'profile'
            ? '/profile'
            : '/onboarding';
    throw redirect(302, `${dest}?ig_error=not_configured`);
  }
  const nonce = crypto.randomUUID();
  // Sign the state so the callback can verify without relying on a cookie.
  // Safari ITP can drop cookies set alongside a 302 redirect.
  const state = signOAuthState(nonce);

  cookies.set('ig_oauth_state', nonce, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: cookieSecure,
  });
  cookies.set('ig_oauth_from', from, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: cookieSecure,
  });

  const authUrl = getInstagramAuthUrl(state);
  throw redirect(302, authUrl);
};

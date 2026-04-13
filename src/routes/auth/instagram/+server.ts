/**
 * GET /auth/instagram
 * Initiates the Instagram OAuth flow.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstagramAuthUrl } from '$lib/server/instagram';
import { INSTAGRAM_APP_ID } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ cookies, url }) => {
  const from = url.searchParams.get('from') ?? 'onboarding';
  if (!INSTAGRAM_APP_ID?.trim()) {
    const dest = from === 'profile' ? '/profile' : '/onboarding';
    throw redirect(302, `${dest}?ig_error=not_configured`);
  }
  const state = crypto.randomUUID();
  cookies.set('ig_oauth_state', state, {
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
  console.log('[IG Auth] Redirecting to Instagram OAuth (from:', from, ')');
  console.log('[IG Auth] Redirect URI configured:', `${PUBLIC_BASE_URL}/auth/instagram/callback`);

  throw redirect(302, authUrl);
};

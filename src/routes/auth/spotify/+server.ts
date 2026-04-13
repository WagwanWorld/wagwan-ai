import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpotifyAuthUrl, isSpotifyConfigured } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ cookies, url }) => {
  if (!isSpotifyConfigured()) {
    throw redirect(302, '/profile?error=spotify_not_configured');
  }

  const from = url.searchParams.get('from') ?? 'profile';
  const state = crypto.randomUUID();
  cookies.set('spotify_oauth_state', state, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
  cookies.set('spotify_oauth_from', from, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });

  throw redirect(302, getSpotifyAuthUrl(state));
};

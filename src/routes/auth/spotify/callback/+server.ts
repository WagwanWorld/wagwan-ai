import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exchangeSpotifyCode,
  fetchSpotifyEnrichedData,
  analyseSpotifyIdentityEnriched,
} from '$lib/server/spotify';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('spotify_oauth_state');

  cookies.delete('spotify_oauth_state', { path: '/' });

  const from = cookies.get('spotify_oauth_from') ?? 'profile';
  cookies.delete('spotify_oauth_from', { path: '/' });
  const returnBase = from === 'onboarding' ? '/onboarding' : '/profile';

  if (!code || !state || state !== storedState) {
    throw redirect(302, `${returnBase}?error=spotify_invalid_state`);
  }

  try {
    const token = await exchangeSpotifyCode(code);
    const enriched = await fetchSpotifyEnrichedData(token);
    const identity = await analyseSpotifyIdentityEnriched(enriched);

    cookies.set('spotify_identity', JSON.stringify(identity), {
      path: '/',
      maxAge: 600,
      httpOnly: false,
      sameSite: 'lax',
    });
    cookies.set('spotify_token', token, {
      path: '/',
      maxAge: 600,
      httpOnly: false,
      sameSite: 'lax',
    });

    throw redirect(302, `${returnBase}?spotify=connected`);
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error('Spotify callback error:', e);
    throw redirect(302, `${returnBase}?error=spotify_failed`);
  }
};

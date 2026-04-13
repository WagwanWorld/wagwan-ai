import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGoogleAuthUrl, isGoogleConfigured } from '$lib/server/google';

export const GET: RequestHandler = async ({ cookies, url }) => {
  if (!isGoogleConfigured()) {
    throw redirect(302, '/profile?error=google_not_configured');
  }

  const from = url.searchParams.get('from') ?? 'profile';
  const state = crypto.randomUUID();
  cookies.set('google_oauth_state', state, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
  cookies.set('google_oauth_from', from, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
  throw redirect(302, getGoogleAuthUrl(state));
};

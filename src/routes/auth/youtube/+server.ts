import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getYouTubeAuthUrl, isYouTubeConfigured } from '$lib/server/youtube';

export const GET: RequestHandler = async ({ cookies }) => {
  if (!isYouTubeConfigured()) {
    throw redirect(302, '/profile?error=youtube_not_configured');
  }

  const state = crypto.randomUUID();
  cookies.set('youtube_oauth_state', state, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });

  throw redirect(302, getYouTubeAuthUrl(state));
};

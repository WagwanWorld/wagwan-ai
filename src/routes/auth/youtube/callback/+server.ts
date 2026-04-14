import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeYouTubeCode, fetchYouTubeData, analyseYouTubeIdentity } from '$lib/server/youtube';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('youtube_oauth_state');

  cookies.delete('youtube_oauth_state', { path: '/' });

  if (!code || !state || state !== storedState) {
    throw redirect(302, '/profile?error=youtube_invalid_state');
  }

  try {
    const token = await exchangeYouTubeCode(code);
    const { channels, channelDescriptions, categories, tags, videoTitles } = await fetchYouTubeData(token);
    const identity = await analyseYouTubeIdentity(channels, categories, tags, videoTitles, channelDescriptions);

    cookies.set('youtube_identity', JSON.stringify(identity), {
      path: '/',
      maxAge: 600,
      httpOnly: false,
      sameSite: 'lax',
    });

    throw redirect(302, '/profile?youtube=connected');
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error('YouTube callback error:', e);
    throw redirect(302, '/profile?error=youtube_failed');
  }
};

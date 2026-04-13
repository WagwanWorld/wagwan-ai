import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLinkedInAuthUrl, isLinkedInConfigured } from '$lib/server/linkedin';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const from = url.searchParams.get('from') ?? 'profile';
  if (!isLinkedInConfigured()) {
    throw redirect(
      302,
      from === 'onboarding' ? '/onboarding?error=linkedin_not_configured' : '/profile?error=linkedin_not_configured',
    );
  }
  const state = crypto.randomUUID();
  cookies.set('linkedin_oauth_state', state, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });
  cookies.set('linkedin_oauth_from', from, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });

  throw redirect(302, getLinkedInAuthUrl(state));
};

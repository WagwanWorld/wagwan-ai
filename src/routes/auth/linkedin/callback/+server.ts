import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeLinkedInCode, fetchLinkedInProfile, analyseLinkedInIdentity } from '$lib/server/linkedin';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('linkedin_oauth_state');
  const error = url.searchParams.get('error');

  cookies.delete('linkedin_oauth_state', { path: '/' });

  const from = cookies.get('linkedin_oauth_from') ?? 'profile';
  cookies.delete('linkedin_oauth_from', { path: '/' });
  const returnBase = from === 'onboarding' ? '/onboarding' : '/profile';

  if (error) {
    console.error('LinkedIn OAuth error:', error, url.searchParams.get('error_description'));
    throw redirect(302, `${returnBase}?error=linkedin_denied`);
  }

  if (!code || !state || state !== storedState) {
    throw redirect(302, `${returnBase}?error=linkedin_invalid_state`);
  }

  try {
    const token = await exchangeLinkedInCode(code);
    const { name, email, headline, industry, country } = await fetchLinkedInProfile(token);
    const identity = await analyseLinkedInIdentity(name, headline, industry, '', country, email);

    cookies.set('linkedin_identity', JSON.stringify(identity), {
      path: '/',
      maxAge: 600,
      httpOnly: false,
      sameSite: 'lax',
    });
    cookies.set('linkedin_token', token, {
      path: '/',
      maxAge: 600,
      httpOnly: false,
      sameSite: 'lax',
    });
  } catch (e) {
    console.error('LinkedIn callback error:', e);
    throw redirect(302, `${returnBase}?error=linkedin_failed`);
  }

  throw redirect(302, `${returnBase}?linkedin=connected`);
};

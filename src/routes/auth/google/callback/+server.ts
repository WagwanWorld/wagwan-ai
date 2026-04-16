import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exchangeGoogleCode,
  fetchYouTubeData,
  fetchGmailSummary,
  analyseGoogleIdentity,
} from '$lib/server/google';
import { computeGoogleTwinForToken } from '$lib/server/signalProcessor/googleProcessor';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const storedState = cookies.get('google_oauth_state');
  cookies.delete('google_oauth_state', { path: '/' });

  const from = cookies.get('google_oauth_from') ?? 'profile';
  cookies.delete('google_oauth_from', { path: '/' });
  const returnBase = from === 'landing' ? '/' : from === 'onboarding' ? '/onboarding' : '/profile';

  if (error) throw redirect(302, `${returnBase}?error=google_${error}`);
  if (!code || !state || state !== storedState) {
    throw redirect(302, `${returnBase}?error=google_invalid_state`);
  }

  try {
    const { accessToken, refreshToken } = await exchangeGoogleCode(code);

    const [ytData, gmailData, twinData] = await Promise.allSettled([
      fetchYouTubeData(accessToken),
      fetchGmailSummary(accessToken),
      computeGoogleTwinForToken(accessToken),
    ]);

    const yt = ytData.status === 'fulfilled' ? ytData.value : { channels: [], categories: [] };
    const gmail = gmailData.status === 'fulfilled' ? gmailData.value : { threads: [], senders: [] };
    const twin = twinData.status === 'fulfilled' ? twinData.value : null;

    let email = '', name = '', picture = '', sub = '';
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (uRes.ok) {
        const u = await uRes.json();
        sub = u.sub ?? '';
        email = u.email ?? '';
        name = u.name ?? '';
        picture = u.picture ?? '';
      }
    } catch { /* ignore */ }

    const identity = await analyseGoogleIdentity(
      yt.channels,
      yt.categories,
      gmail.threads,
      gmail.senders,
      email, name, picture,
      twin?.lifestylePatterns,
    );

    // Attach the stable Google sub to the identity object
    (identity as unknown as Record<string, unknown>).sub = sub;
    if (twin) identity.twin = twin;

    // Store identity + tokens in short-lived cookie for profile page to read
    cookies.set('google_identity', JSON.stringify(identity), {
      path: '/', maxAge: 600, httpOnly: false, sameSite: 'lax',
    });
    cookies.set('google_tokens', JSON.stringify({ accessToken, refreshToken }), {
      path: '/', maxAge: 600, httpOnly: false, sameSite: 'lax',
    });

    throw redirect(302, `${returnBase}?google_connected=1`);
  } catch (e) {
    // Re-throw SvelteKit redirects (they are thrown objects with a 'location' property)
    if (e && typeof e === 'object' && 'location' in e) throw e;
    console.error('Google callback error:', e);
    throw redirect(302, `${returnBase}?error=google_failed`);
  }
};

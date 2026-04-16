/**
 * GET /auth/instagram/callback
 *
 * 1. Validates state (CSRF)
 * 2. Exchanges code for access token
 * 3. Fetches user profile + media
 * 4. Runs full identity pipeline (visual, caption, temporal, engagement, comments)
 * 5. Stores result server-side with a redemption token
 * 6. Redirects to onboarding — client fetches identity via /api/instagram/identity
 */
import { redirect, error, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exchangeCodeForToken,
  fetchInstagramProfile,
  fetchInstagramMedia,
  analyseInstagramIdentity,
} from '$lib/server/instagram';
import { storeIdentity } from '$lib/server/igIdentityStore';
import { PUBLIC_BASE_URL } from '$env/static/public';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const errReason = url.searchParams.get('error_reason') || '';
  const errDesc = url.searchParams.get('error_description') || '';

  console.log('[IG Callback] Received callback', {
    hasCode: !!code,
    hasState: !!state,
    error: err,
    errorReason: errReason,
    redirectUri: `${PUBLIC_BASE_URL}/auth/instagram/callback`,
  });

  const fromPage = cookies.get('ig_oauth_from') ?? 'onboarding';
  cookies.delete('ig_oauth_from', { path: '/' });
  const returnBase = fromPage === 'landing' ? '/' : fromPage === 'profile' ? '/profile' : '/onboarding';

  if (err) {
    console.warn('[IG Callback] User denied or error:', err, errReason, errDesc);
    throw redirect(302, `${returnBase}?ig_error=` + encodeURIComponent(errDesc || errReason || err));
  }

  const savedState = cookies.get('ig_oauth_state');
  cookies.delete('ig_oauth_state', { path: '/' });
  if (!state || state !== savedState) {
    console.error('[IG Callback] State mismatch:', { received: state, expected: savedState });
    throw error(400, 'Invalid OAuth state — possible CSRF. Try connecting again.');
  }

  if (!code) throw error(400, 'Missing authorization code');

  try {
    console.log('[IG Callback] Exchanging code for token...');
    const token = await exchangeCodeForToken(code);
    console.log('[IG Callback] Token obtained, fetching profile + media...');

    const [igProfile, igMedia] = await Promise.all([
      fetchInstagramProfile(token),
      fetchInstagramMedia(token, 20),
    ]);
    console.log('[IG Callback] Profile:', igProfile.username, '| Media count:', igMedia.length);

    console.log('[IG Callback] Running full identity pipeline (visual + caption + temporal + engagement + comments)...');
    const identity = await analyseInstagramIdentity(igProfile, igMedia, token);
    console.log('[IG Callback] Identity complete:', identity.aesthetic, '| visual:', !!identity.visual);

    // Store full identity + access token server-side, give client a redemption token
    const redemptionToken = crypto.randomUUID();
    await storeIdentity(redemptionToken, identity, token);

    cookies.set('ig_redemption', redemptionToken, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 300,
      secure: cookieSecure,
    });

    console.log('[IG Callback] Success — redirecting to', returnBase, 'with redemption token');
    // ig_rt: reliable when cookies are blocked or lost across workers (Redis helps the API node too).
    throw redirect(
      302,
      `${returnBase}?ig_connected=1&ig_rt=${encodeURIComponent(redemptionToken)}`,
    );

  } catch (e: unknown) {
    if (isRedirect(e)) throw e;
    console.error('[IG Callback] Error:', e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : 'auth_failed';
    throw redirect(302, `${returnBase}?ig_error=` + encodeURIComponent(msg));
  }
};

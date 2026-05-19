import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  exchangeBrandCodeForToken,
  fetchBrandProfile,
} from '$lib/server/marketplace/brandInstagram';
import {
  BRAND_SESSION_COOKIE,
  BRAND_SESSION_MAX_AGE_SEC,
  mintBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';
import { verifyOAuthState } from '$lib/server/marketplace/oauthState';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  const savedCookieNonce = cookies.get('brand_ig_oauth_state');
  cookies.delete('brand_ig_oauth_state', { path: '/' });

  if (err) throw redirect(302, `/?error=${encodeURIComponent(err)}`);
  if (!code || !state) {
    throw error(400, 'Invalid OAuth state');
  }

  // Verify state: prefer the cryptographic signature (works even when Safari
  // ITP drops the cookie), fall back to cookie nonce comparison.
  const signedNonce = verifyOAuthState(state);
  const cookieMatch = savedCookieNonce && signedNonce === savedCookieNonce;
  if (!signedNonce && !cookieMatch) {
    throw error(400, 'Invalid OAuth state');
  }

  try {
    const token = await exchangeBrandCodeForToken(code);
    const profile = await fetchBrandProfile(token);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured');

    // Upsert into brand_accounts via Supabase REST API
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/brand_accounts`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        ig_user_id: profile.id,
        ig_username: profile.username,
        ig_name: profile.name || '',
        ig_profile_picture: profile.profile_picture_url || '',
        ig_followers_count: profile.followers_count || 0,
        ig_access_token: token,
        token_expires_at: expiresAt.toISOString(),
        last_login_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const errBody = await upsertRes.text().catch(() => '');
      console.error('[Brand IG Callback] Supabase upsert failed:', upsertRes.status, errBody);
      throw new Error(`DB upsert failed: ${upsertRes.status}`);
    }

    // Ensure a brands row exists and brand_accounts.brand_id is linked.
    // Without this, the brand portal can't find campaigns for this account.
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(profile.id)}&select=brand_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );
    const checkRows = checkRes.ok ? await checkRes.json() : [];
    const existingBrandId = checkRows[0]?.brand_id;

    if (!existingBrandId) {
      // Create a brands row using the IG username as the brand name
      const brandName = profile.name || profile.username || 'Brand';
      const brandInsertRes = await fetch(`${supabaseUrl}/rest/v1/brands`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ name: brandName }),
      });
      if (brandInsertRes.ok) {
        const brandRows = await brandInsertRes.json();
        const newBrandId = brandRows[0]?.id;
        if (newBrandId) {
          await fetch(
            `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(profile.id)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ brand_id: newBrandId }),
            },
          );
        }
      }
    }

    // Set session cookie with ig_user_id
    const sessionValue = mintBrandSessionCookieValue(profile.id);
    cookies.set(BRAND_SESSION_COOKIE, sessionValue, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      maxAge: BRAND_SESSION_MAX_AGE_SEC,
    });

    throw redirect(302, '/brands/portal');
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'location' in e) throw e;
    console.error('[Brand IG Callback]', e);
    throw redirect(302, `/?error=auth_failed`);
  }
};

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
import { PUBLIC_BASE_URL } from '$env/static/public';
import pg from 'pg';

const cookieSecure = PUBLIC_BASE_URL.startsWith('https://');

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  const savedState = cookies.get('brand_ig_oauth_state');
  cookies.delete('brand_ig_oauth_state', { path: '/' });

  if (err) throw redirect(302, `/brands/login?error=${encodeURIComponent(err)}`);
  if (!code || !state || state !== savedState) {
    throw error(400, 'Invalid OAuth state');
  }

  try {
    const token = await exchangeBrandCodeForToken(code);
    const profile = await fetchBrandProfile(token);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    // Upsert into brand_accounts
    const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });
    try {
      await pool.query(
        `INSERT INTO brand_accounts (ig_user_id, ig_username, ig_name, ig_profile_picture, ig_followers_count, ig_access_token, token_expires_at, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (ig_user_id) DO UPDATE SET
           ig_username = EXCLUDED.ig_username,
           ig_name = EXCLUDED.ig_name,
           ig_profile_picture = EXCLUDED.ig_profile_picture,
           ig_followers_count = EXCLUDED.ig_followers_count,
           ig_access_token = EXCLUDED.ig_access_token,
           token_expires_at = EXCLUDED.token_expires_at,
           last_login_at = now()`,
        [profile.id, profile.username, profile.name || '', profile.profile_picture_url || '', profile.followers_count || 0, token, expiresAt],
      );
    } finally {
      await pool.end();
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
    throw redirect(302, `/brands/login?error=auth_failed`);
  }
};

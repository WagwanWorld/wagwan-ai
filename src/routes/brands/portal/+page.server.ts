import type { PageServerLoad } from './$types';
import {
  BRAND_SESSION_COOKIE,
  verifyBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';
import pg from 'pg';

export const load: PageServerLoad = async ({ cookies }) => {
  const raw = cookies.get(BRAND_SESSION_COOKIE);
  const igUserId = verifyBrandSessionCookieValue(raw);
  const isValid = !!igUserId && igUserId !== '__legacy__';

  let brandProfile = null;
  if (isValid && igUserId && igUserId !== '__legacy__') {
    try {
      const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });
      try {
        const { rows: [brand] } = await pool.query(
          `SELECT ig_user_id, ig_username, ig_name, ig_profile_picture, ig_followers_count FROM brand_accounts WHERE ig_user_id = $1`,
          [igUserId],
        );
        brandProfile = brand || null;
      } finally {
        await pool.end();
      }
    } catch {}
  }

  return {
    brandSessionValid: isValid,
    brandProfile,
  };
};

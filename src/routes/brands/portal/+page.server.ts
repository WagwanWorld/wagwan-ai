import type { PageServerLoad } from './$types';
import {
  BRAND_SESSION_COOKIE,
  verifyBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ cookies }) => {
  const raw = cookies.get(BRAND_SESSION_COOKIE);
  const igUserId = verifyBrandSessionCookieValue(raw);
  const isValid = !!igUserId && igUserId !== '__legacy__';

  let brandProfile: Record<string, unknown> | null = null;

  if (isValid && igUserId && igUserId !== '__legacy__') {
    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_user_id,ig_username,ig_name,ig_profile_picture,ig_followers_count&limit=1`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          },
        );
        if (res.ok) {
          const rows = await res.json();
          brandProfile = rows[0] || null;
        }
      }
    } catch {}
  }

  return {
    brandSessionValid: isValid,
    brandProfile,
  };
};

import type { PageServerLoad } from './$types';
import {
  BRAND_SESSION_COOKIE,
  verifyBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';

export const load: PageServerLoad = async ({ cookies }) => {
  const raw = cookies.get(BRAND_SESSION_COOKIE);
  return {
    brandSessionValid: verifyBrandSessionCookieValue(raw),
  };
};

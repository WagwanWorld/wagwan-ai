import { env } from '$env/dynamic/private';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId } from '$lib/server/supabase';

type AuthResult =
  | { ok: true; googleSub: string }
  | { ok: false; status: 401 | 403 | 503; error: string; message?: string };

function hasCronSecret(request: Request): boolean {
  const secret = env.CRON_SECRET?.trim();
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Resolve and authorize the google_sub behind a user mutation.
 *
 * These routes use the service-role Supabase client, so they must not trust a
 * body-supplied googleSub. The caller must prove ownership with the Wagwan JWT
 * that was linked to user_profiles.wagwan_user_id.
 */
export async function authorizeUserGoogleSub(
  request: Request,
  requestedGoogleSub: string,
  options: { allowCronSecret?: boolean } = {},
): Promise<AuthResult> {
  if (options.allowCronSecret && hasCronSecret(request)) {
    return { ok: true, googleSub: requestedGoogleSub };
  }

  if (!isWagwanAuthConfigured()) {
    return {
      ok: false,
      status: 503,
      error: 'wagwan_auth_not_configured',
      message: 'Authenticated wallet actions are not configured yet.',
    };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return {
      ok: false,
      status: 401,
      error: 'invalid_or_missing_token',
      message: 'Sign in to Wagwan before changing wallet balances.',
    };
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  const linkedSub = profile?.google_sub?.trim() ?? '';
  if (!linkedSub) {
    return {
      ok: false,
      status: 403,
      error: 'profile_not_linked',
      message: 'Link this Wagwan account to your creator profile before changing wallet balances.',
    };
  }

  if (linkedSub !== requestedGoogleSub) {
    return { ok: false, status: 403, error: 'google_sub_mismatch' };
  }

  return { ok: true, googleSub: linkedSub };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
};

export type CreatorAuthResult =
  | { creator: AuthenticatedCreator; error: null; status: null }
  | { creator: null; error: string; status: number };

export async function resolveAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<CreatorAuthResult> {
  if (!isWagwanAuthConfigured()) {
    return { creator: null, error: 'wagwan_auth_not_configured', status: 503 };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { creator: null, error: 'invalid_or_missing_token', status: 401 };
  }

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data, wagwan_user_id')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] profile lookup failed:', error.message);
    return { creator: null, error: 'profile_lookup_failed', status: 500 };
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) {
    return { creator: null, error: 'creator_profile_not_linked', status: 403 };
  }

  return {
    creator: {
      googleSub,
      wagwanUserId,
      profileData: (data?.profile_data ?? {}) as Record<string, unknown>,
    },
    error: null,
    status: null,
  };
}

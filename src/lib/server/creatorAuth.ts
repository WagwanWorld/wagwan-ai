import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import type { UserProfileRow } from '$lib/server/supabase';

export type AuthenticatedCreator =
  | { ok: true; googleSub: string; profile: UserProfileRow }
  | { ok: false; status: 401 | 403 | 503; error: string };

export async function authenticateCreatorRequest(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const { data, error } = await sb
    .from('user_profiles')
    .select('*')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] linked profile lookup failed:', error.message);
    return { ok: false, status: 503, error: 'profile_lookup_failed' };
  }
  if (!data?.google_sub) {
    return { ok: false, status: 403, error: 'creator_profile_not_linked' };
  }

  return { ok: true, googleSub: data.google_sub as string, profile: data as UserProfileRow };
}

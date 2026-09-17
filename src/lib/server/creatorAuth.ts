import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  wagwanUserId: string;
  googleSub: string;
  profileData: Record<string, unknown>;
};

export async function requireAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'wagwan_auth_not_configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'invalid_or_missing_token');
  }

  const { data: profile, error: profileErr } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (profileErr) {
    console.error('[creatorAuth] profile lookup failed:', profileErr.message);
    throw error(500, 'creator_profile_lookup_failed');
  }
  if (!profile?.google_sub) {
    throw error(403, 'creator_profile_not_linked');
  }

  return {
    wagwanUserId,
    googleSub: String(profile.google_sub),
    profileData: (profile.profile_data ?? {}) as Record<string, unknown>,
  };
}

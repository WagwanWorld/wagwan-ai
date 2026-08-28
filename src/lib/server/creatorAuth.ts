import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
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

  const { data, error: lookupError } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (lookupError) {
    console.error('[creatorAuth] linked profile lookup failed:', lookupError.message);
    throw error(500, 'creator_lookup_failed');
  }
  if (!data?.google_sub) {
    throw error(403, 'creator_profile_not_linked');
  }

  return {
    googleSub: data.google_sub as string,
    wagwanUserId,
    profileData: ((data.profile_data ?? {}) as Record<string, unknown>) ?? {},
  };
}

export function creatorInstagramUsername(profileData: Record<string, unknown>): string | null {
  const identity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const username = typeof identity?.username === 'string' ? identity.username : '';
  return normalizeIgHandle(username);
}

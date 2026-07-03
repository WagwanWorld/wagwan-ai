import { error } from '@sveltejs/kit';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, type UserProfileRow } from '$lib/server/supabase';

export interface AuthenticatedCreator {
  wagwanUserId: string;
  googleSub: string;
  profile: UserProfileRow;
}

export async function requireAuthenticatedCreator(request: Request): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'wagwan_auth_not_configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'invalid_or_missing_token');
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile?.google_sub) {
    throw error(403, 'creator_profile_link_required');
  }

  return {
    wagwanUserId,
    googleSub: profile.google_sub,
    profile,
  };
}

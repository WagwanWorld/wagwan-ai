import { error } from '@sveltejs/kit';
import { getProfileByWagwanId, type UserProfileRow } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  wagwanUserId: string;
  googleSub: string;
  profile: UserProfileRow;
};

/**
 * Creator APIs must not trust request-provided googleSub values. The Wagwan
 * bearer token proves the caller, and the linked profile determines googleSub.
 */
export async function requireAuthenticatedCreator(request: Request): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Invalid or missing Wagwan token');
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile?.google_sub) {
    throw error(403, 'Wagwan account is not linked to a creator profile');
  }

  return {
    wagwanUserId,
    googleSub: profile.google_sub,
    profile,
  };
}

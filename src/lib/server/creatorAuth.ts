import { error } from '@sveltejs/kit';
import type { UserProfileRow } from './supabase';
import { getProfileByWagwanId } from './supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';

export type AuthenticatedCreator = {
  wagwanUserId: string;
  googleSub: string;
  profile: UserProfileRow;
};

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

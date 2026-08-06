import { error } from '@sveltejs/kit';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, type UserProfileRow } from '$lib/server/supabase';

export type AuthenticatedCreatorProfile = {
  googleSub: string;
  wagwanUserId: string;
  profile: UserProfileRow;
  profileData: Record<string, unknown>;
};

export async function assertCreatorProfileFromRequest(
  request: Request,
): Promise<AuthenticatedCreatorProfile> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth is not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Missing or invalid Wagwan token');
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile?.google_sub) {
    throw error(403, 'No linked creator profile found');
  }

  return {
    googleSub: profile.google_sub,
    wagwanUserId,
    profile,
    profileData: (profile.profile_data ?? {}) as Record<string, unknown>,
  };
}

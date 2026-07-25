import { error } from '@sveltejs/kit';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, type UserProfileRow } from '$lib/server/supabase';
export { getCreatorInstagramUsername } from '$lib/server/creatorProfile';

export async function requireCreatorProfile(request: Request): Promise<UserProfileRow> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Invalid or missing creator token');
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    throw error(404, 'Creator profile not linked');
  }

  return profile;
}

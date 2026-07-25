import { error } from '@sveltejs/kit';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, type UserProfileRow } from '$lib/server/supabase';

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

export function getCreatorInstagramUsername(profile: UserProfileRow): string | null {
  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const username = String(instagramIdentity?.username ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  return username || null;
}

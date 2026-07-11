import type { UserProfileRow } from '$lib/server/supabase';
import { getProfileByWagwanId } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { normalizeInstagramUsername } from '$lib/utils/creatorIdentity';
export { instagramUsernamesMatch, normalizeInstagramUsername } from '$lib/utils/creatorIdentity';

export type AuthenticatedCreator =
  | {
      ok: true;
      googleSub: string;
      profile: UserProfileRow;
      instagramUsername: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export function instagramUsernameFromProfile(profile: UserProfileRow): string | null {
  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const username = normalizeInstagramUsername(instagramIdentity?.username);
  return username || null;
}

export async function getAuthenticatedCreator(request: Request): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return { ok: false, status: 403, error: 'creator_profile_not_linked' };
  }

  return {
    ok: true,
    googleSub: profile.google_sub,
    profile,
    instagramUsername: instagramUsernameFromProfile(profile),
  };
}

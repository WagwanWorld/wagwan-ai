import type { UserProfileRow } from '$lib/server/supabase';
import { getProfileByWagwanId } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
export {
  creatorInstagramUsername,
  creatorMatchesRosterInstagram,
  normalizeInstagramUsername,
} from '$lib/utils/creatorIdentity';

export type CreatorAuthResult =
  | { ok: true; profile: UserProfileRow; wagwanUserId: string }
  | { ok: false; status: number; error: string };

export async function requireCreatorProfile(request: Request): Promise<CreatorAuthResult> {
  if (!isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return { ok: false, status: 401, error: 'profile_not_linked' };
  }

  return { ok: true, profile, wagwanUserId };
}

import type { UserProfileRow } from '$lib/server/supabase';
import { getProfileByWagwanId } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

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

export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return normalized || null;
}

export function creatorInstagramUsername(
  profile: Pick<UserProfileRow, 'profile_data'>,
): string | null {
  const data = profile.profile_data ?? {};
  const instagramIdentity =
    typeof data.instagramIdentity === 'object' && data.instagramIdentity !== null
      ? (data.instagramIdentity as Record<string, unknown>)
      : null;
  return normalizeInstagramUsername(instagramIdentity?.username);
}

export function creatorMatchesRosterInstagram(
  profile: Pick<UserProfileRow, 'profile_data'>,
  rosterIgUsername: unknown,
): boolean {
  const creatorHandle = creatorInstagramUsername(profile);
  const rosterHandle = normalizeInstagramUsername(rosterIgUsername);
  return Boolean(creatorHandle && rosterHandle && creatorHandle === rosterHandle);
}

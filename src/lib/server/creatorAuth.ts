import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from '$lib/server/wagwanAuth';
import type { UserProfileRow } from '$lib/server/supabase';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  instagramUsername: string | null;
};

export function normalizeCreatorUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
}

export function getProfileInstagramUsername(profileData: Record<string, unknown> | null): string {
  const instagram = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeCreatorUsername(instagram?.username);
}

export function creatorProfileMatchesRosterHandle(
  profileData: Record<string, unknown> | null,
  rosterHandle: string,
): boolean {
  const profileUsername = getProfileInstagramUsername(profileData);
  return !!profileUsername && profileUsername === normalizeCreatorUsername(rosterHandle);
}

export async function requireCreatorFromWagwanRequest(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Invalid or missing Wagwan token');
  }

  const { data, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data, wagwan_user_id')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (qErr) {
    console.error('[creatorAuth] profile lookup failed:', qErr.message);
    throw error(500, 'Could not verify creator');
  }
  if (!data) {
    throw error(401, 'Creator profile is not linked to this Wagwan account');
  }

  const row = data as Pick<UserProfileRow, 'google_sub' | 'profile_data' | 'wagwan_user_id'>;
  const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
  return {
    googleSub: row.google_sub,
    wagwanUserId,
    profileData,
    instagramUsername: getProfileInstagramUsername(profileData) || null,
  };
}

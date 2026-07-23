import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreatorProfile = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  instagramUsername: string | null;
};

export function normalizeInstagramUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const username = raw.trim().replace(/^@/, '').toLowerCase();
  return username || null;
}

export function instagramUsernameFromProfileData(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const identity = profileData?.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;
  return normalizeInstagramUsername((identity as Record<string, unknown>).username);
}

export async function requireAuthenticatedCreatorProfile(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreatorProfile> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Creator authentication required');
  }

  const { data, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, wagwan_user_id, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (qErr) {
    console.error('[creatorAuth] profile lookup failed:', qErr.message);
    throw error(500, 'Could not authenticate creator');
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) {
    throw error(403, 'Creator profile is not linked');
  }

  const profileData = ((data?.profile_data ?? {}) as Record<string, unknown>) ?? {};
  return {
    googleSub,
    wagwanUserId,
    profileData,
    instagramUsername: instagramUsernameFromProfileData(profileData),
  };
}

import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  instagramUsername: string | null;
};

function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return normalized || null;
}

export function instagramUsernameFromProfile(profileData: Record<string, unknown>): string | null {
  const identity = profileData.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;
  return normalizeInstagramUsername((identity as Record<string, unknown>).username);
}

export async function assertCreatorAccess(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Creator session required');
  }

  const { data: profile, error: dbError } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (dbError) {
    console.error('[creatorAuth] profile lookup failed:', dbError.message);
    throw error(500, 'Could not verify creator session');
  }

  const googleSub = typeof profile?.google_sub === 'string' ? profile.google_sub.trim() : '';
  if (!googleSub) {
    throw error(403, 'Creator profile not linked');
  }

  const profileData =
    profile?.profile_data && typeof profile.profile_data === 'object'
      ? (profile.profile_data as Record<string, unknown>)
      : {};

  return {
    googleSub,
    wagwanUserId,
    profileData,
    instagramUsername: instagramUsernameFromProfile(profileData),
  };
}

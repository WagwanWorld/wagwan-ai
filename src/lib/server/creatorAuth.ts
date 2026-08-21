import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  instagramUsername: string | null;
};

type CreatorAuthResult =
  | { ok: true; creator: AuthenticatedCreator }
  | { ok: false; status: number; error: string };

export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let username = value.trim();
  if (!username) return null;
  username = username.replace(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, '');
  username = username.split('/')[0] ?? username;
  username = username.split('?')[0] ?? username;
  username = username.replace(/^@/, '').trim().toLowerCase();
  return username || null;
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const instagram = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagram?.username);
}

export async function getAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<CreatorAuthResult> {
  if (!isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] profile lookup failed:', error.message);
    return { ok: false, status: 500, error: 'profile_lookup_failed' };
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) {
    return { ok: false, status: 403, error: 'creator_profile_not_linked' };
  }

  const profileData = (data?.profile_data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    creator: {
      googleSub,
      wagwanUserId,
      profileData,
      instagramUsername: profileInstagramUsername(profileData),
    },
  };
}

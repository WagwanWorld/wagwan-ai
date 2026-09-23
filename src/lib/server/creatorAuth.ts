import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
};

export type CreatorAuthFailure = {
  status: 401 | 503;
  error: 'wagwan_auth_not_configured' | 'invalid_or_missing_token' | 'creator_profile_not_linked';
};

export function normalizeInstagramUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string {
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}

export async function getAuthenticatedCreator(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator | CreatorAuthFailure> {
  if (!isWagwanAuthConfigured()) {
    return { status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { status: 401, error: 'invalid_or_missing_token' };
  }

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (error || !googleSub) {
    return { status: 401, error: 'creator_profile_not_linked' };
  }

  return {
    googleSub,
    wagwanUserId,
    profileData: (data.profile_data ?? {}) as Record<string, unknown>,
  };
}

export function isCreatorAuthFailure(
  value: AuthenticatedCreator | CreatorAuthFailure,
): value is CreatorAuthFailure {
  return 'error' in value;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  instagramUsername: string | null;
  profileData: Record<string, unknown>;
};

export function normalizeInstagramUsername(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  let username = raw.replace(/^@/, '').toLowerCase();
  username = username.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  username = username.split(/[/?#]/)[0] ?? username;
  username = username.trim();

  return username || null;
}

export async function resolveAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<AuthenticatedCreator | null> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data: profile, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error || !profile?.google_sub) return null;

  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;

  return {
    googleSub: String(profile.google_sub),
    wagwanUserId,
    instagramUsername: normalizeInstagramUsername(instagramIdentity?.username),
    profileData,
  };
}

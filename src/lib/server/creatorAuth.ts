import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from './wagwanAuth';
import { normalizeIgHandle } from './marketplace/creatorInviteUtils';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
};

export async function requireCreatorFromWagwanRequest(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'invalid_or_missing_token');
  }

  const { data, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, wagwan_user_id, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (qErr) {
    console.error('[creatorAuth] profile lookup failed:', qErr.message);
    throw error(500, 'creator_lookup_failed');
  }
  if (!data?.google_sub) {
    throw error(403, 'creator_not_linked');
  }

  return {
    googleSub: String(data.google_sub),
    wagwanUserId,
    profileData: ((data.profile_data as Record<string, unknown> | null) ?? {}) as Record<
      string,
      unknown
    >,
  };
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const identity = profileData.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;

  const raw =
    (identity as Record<string, unknown>).username ?? (identity as Record<string, unknown>).handle;
  return typeof raw === 'string' ? normalizeIgHandle(raw) : null;
}

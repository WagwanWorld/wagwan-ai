import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
export { instagramUsernameFromProfile, normalizeInstagramUsername } from './creatorIdentity';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
};

export async function resolveAuthenticatedCreator(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator | null> {
  if (!isWagwanAuthConfigured()) return null;

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] profile lookup failed:', error.message);
    return null;
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) return null;

  return {
    googleSub,
    wagwanUserId,
    profileData: (data?.profile_data ?? {}) as Record<string, unknown>,
  };
}

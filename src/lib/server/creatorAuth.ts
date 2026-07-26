import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import type { UserProfileRow } from '$lib/server/supabase';
export {
  getProfileInstagramUsername,
  normalizeInstagramUsername,
} from '$lib/server/creatorIdentity';

export type AuthenticatedCreator = {
  googleSub: string;
  profileData: Record<string, unknown>;
  wagwanUserId: string;
};

export async function requireAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Creator authentication required');
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
    throw error(403, 'Wagwan user is not linked to a creator profile');
  }

  const profile = data as Pick<UserProfileRow, 'google_sub' | 'profile_data' | 'wagwan_user_id'>;
  return {
    googleSub: profile.google_sub,
    profileData: profile.profile_data ?? {},
    wagwanUserId,
  };
}

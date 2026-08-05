import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from '$lib/server/wagwanAuth';
import { instagramUsernameFromProfile } from '$lib/server/creatorIdentity';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  instagramUsername: string | null;
};

export async function getAuthenticatedCreator(
  sb: SupabaseClient,
  request: Request,
): Promise<AuthenticatedCreator | null> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error || !data?.google_sub) {
    return null;
  }

  const profileData = ((data.profile_data ?? {}) as Record<string, unknown>) ?? {};
  return {
    googleSub: String(data.google_sub),
    wagwanUserId,
    profileData,
    instagramUsername: instagramUsernameFromProfile(profileData),
  };
}

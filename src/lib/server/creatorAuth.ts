import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';

export type AuthenticatedCreatorProfile = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
};

export async function requireAuthenticatedCreatorProfile(
  sb: SupabaseClient,
  request: Request,
): Promise<AuthenticatedCreatorProfile> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Invalid or missing creator token');
  }

  const { data, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (qErr) {
    console.error('[creatorAuth] linked profile lookup failed:', qErr.message);
    throw error(500, 'Could not verify creator profile');
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) {
    throw error(403, 'Creator profile is not linked to this Wagwan account');
  }

  return {
    googleSub,
    wagwanUserId,
    profileData: (data.profile_data ?? {}) as Record<string, unknown>,
  };
}

import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfileRow } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export async function requireAuthenticatedCreatorProfile(
  request: Request,
  sb: SupabaseClient,
): Promise<UserProfileRow> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'wagwan_auth_not_configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'invalid_or_missing_token');
  }

  const { data, error: queryErr } = await sb
    .from('user_profiles')
    .select('*')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (queryErr) {
    console.error('[creatorAuth] profile lookup', queryErr.message);
    throw error(500, 'profile_lookup_failed');
  }
  if (!data) {
    throw error(403, 'profile_not_linked');
  }

  return data as UserProfileRow;
}

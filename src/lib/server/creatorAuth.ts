import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from '$lib/server/wagwanAuth';
import type { UserProfileRow } from '$lib/server/supabase';

export async function getAuthenticatedCreatorProfile(
  request: Request,
  sb: SupabaseClient,
): Promise<UserProfileRow | null> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('*')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] profile lookup failed:', error.message);
    return null;
  }

  return (data as UserProfileRow | null) ?? null;
}

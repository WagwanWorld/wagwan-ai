import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from './wagwanAuth';
import { getServiceSupabase } from './supabase';

export type LinkedCreatorProfile = {
  googleSub: string;
  profileData: Record<string, unknown>;
};

export async function resolveLinkedCreatorProfile(
  request: Request,
  sb: SupabaseClient = getServiceSupabase(),
): Promise<LinkedCreatorProfile | null> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[CreatorAuth] linked profile lookup failed:', error.message);
    return null;
  }

  const googleSub = typeof data?.google_sub === 'string' ? data.google_sub.trim() : '';
  if (!googleSub) return null;

  return {
    googleSub,
    profileData: (data?.profile_data as Record<string, unknown>) ?? {},
  };
}
